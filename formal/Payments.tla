------------------------------- MODULE Payments -------------------------------
(***************************************************************************)
(* Money owed on ONE document, paid in parts.                              *)
(*                                                                         *)
(* PART A - Accounts receivable: a customer pays a credit (charge) sale.   *)
(*   ArPay  src/app/api/sales/[id]/payment/route.ts POST                   *)
(*          pre (outside the transaction): sale.findFirst 171, balance =   *)
(*          totalAmount - paidAmount 202-204, refuse if amount > balance   *)
(*          214. No check of sale.status anywhere.                         *)
(*          transaction 237: salePayment.create; sale.update 304-310 with  *)
(*          paidAmount { increment } and status = (snap.paid + amount >=   *)
(*          total) ? 'completed' : 'pending'  (from the stale read, 300).  *)
(*   Void   src/app/api/sales/[id]/void/route.ts (FOR UPDATE NOWAIT 285)   *)
(*          sets status 'voided'. Modelled as one atomic step.             *)
(*                                                                         *)
(* PART B - Accounts payable: we pay a supplier invoice.                   *)
(*   ApPay  src/app/api/payments/route.ts POST                             *)
(*          pre: accountsPayable.findFirst 200, refuse if amount >         *)
(*          balanceAmount 217; THEN, separately, the last payment number   *)
(*          252-270 (unique [businessId, paymentNumber], schema 2548).     *)
(*          transaction 273: payment.create; accountsPayable.update        *)
(*          318-339 paidAmount = snap.paid + amount (ABSOLUTE).            *)
(*   ApBatch src/app/api/payments/batch/route.ts: pre 82/120, transaction  *)
(*          175, paidAmount = snap.paid + allocated (ABSOLUTE, 235-252).   *)
(*          Its numbers carry a "-n" suffix, so they do not collide.       *)
(*                                                                         *)
(* PROPERTIES                                                              *)
(*   ArNoOverpay        - customer payments never exceed the sale total.   *)
(*   ArVoidStaysVoid    - a voided sale is never turned back into a live   *)
(*                        sale by a payment.                               *)
(*   ArStatusMatches    - when idle, a live sale is 'completed' exactly    *)
(*                        when it is paid in full.                         *)
(*   ApPaidIsSum        - the invoice's paidAmount equals the sum of its   *)
(*                        payment rows (no payment lost).                  *)
(*   ApNoOverpay        - supplier payments never exceed the invoice.      *)
(***************************************************************************)
EXTENDS Integers

CONSTANTS Reqs, Kinds, Total, Amounts, OneAtATime, Fixed

VARIABLES arPaid, arRows, arStatus, wasVoided,
          apPaid, apRows, usedNo, lastNo,
          pc, arg, snap, myNo

vars == <<arPaid, arRows, arStatus, wasVoided, apPaid, apRows, usedNo, lastNo, pc, arg, snap, myNo>>

PreOK(r, a) ==
  CASE r = "ArPay"   -> a <= Total - arPaid           \* payment/route.ts:214 (no status check)
    [] r = "Void"    -> arStatus # "voided"
    [] r \in {"ApPay", "ApBatch"} -> a <= Total - apPaid   \* payments/route.ts:217, batch:120

Start(q) ==
  /\ pc[q] = "idle"
  /\ OneAtATime => \A p \in Reqs : pc[p] \in {"idle", "done"}
  /\ \E r \in Kinds, a \in Amounts :
       IF PreOK(r, a)
       THEN /\ pc' = [pc EXCEPT ![q] = IF r = "ApPay" THEN "ApNumber" ELSE r]
            /\ arg' = [arg EXCEPT ![q] = a]
            /\ snap' = [snap EXCEPT ![q] = IF r = "ArPay" THEN arPaid ELSE apPaid]
       ELSE pc' = [pc EXCEPT ![q] = "done"] /\ UNCHANGED <<arg, snap>>
  /\ UNCHANGED <<arPaid, arRows, arStatus, wasVoided, apPaid, apRows, usedNo, lastNo, myNo>>

Done(q) == pc' = [pc EXCEPT ![q] = "done"] /\ UNCHANGED <<arg, snap>>

\* payments/route.ts:252-270, read after the AP read: next number = last committed + 1.
ApNumber(q) ==
  /\ pc[q] = "ApNumber"
  /\ myNo' = [myNo EXCEPT ![q] = lastNo + 1]
  /\ pc' = [pc EXCEPT ![q] = "ApPay"]
  /\ UNCHANGED <<arPaid, arRows, arStatus, wasVoided, apPaid, apRows, usedNo, lastNo, arg, snap>>

\* sales/[id]/payment/route.ts:237-310.
\* Fixed: lock the sale (FOR UPDATE), refuse voided/cancelled, re-check balance, status from the locked row.
CommitArPay(q) ==
  /\ pc[q] = "ArPay"
  /\ LET a == arg[q] IN
     IF Fixed /\ (arStatus = "voided" \/ arPaid + a > Total)
     THEN UNCHANGED <<arPaid, arRows, arStatus>>
     ELSE /\ arPaid' = arPaid + a                                  \* { increment }
          /\ arRows' = arRows + a
          /\ arStatus' = IF (IF Fixed THEN arPaid ELSE snap[q]) + a >= Total
                         THEN "completed" ELSE "pending"
  /\ Done(q)
  /\ UNCHANGED <<wasVoided, apPaid, apRows, usedNo, lastNo, myNo>>

CommitVoid(q) ==
  /\ pc[q] = "Void"
  /\ IF arStatus # "voided" THEN arStatus' = "voided" /\ wasVoided' = TRUE
     ELSE UNCHANGED <<arStatus, wasVoided>>
  /\ Done(q)
  /\ UNCHANGED <<arPaid, arRows, apPaid, apRows, usedNo, lastNo, myNo>>

\* payments/route.ts:273-339. A duplicate paymentNumber fails the insert (P2002) -> rollback.
\* Fixed: lock the AP row, re-check balance, paidAmount { increment }.
CommitApPay(q) ==
  /\ pc[q] = "ApPay"
  /\ LET a == arg[q] IN
     IF myNo[q] \in usedNo \/ (Fixed /\ apPaid + a > Total)
     THEN UNCHANGED <<apPaid, apRows, usedNo, lastNo>>
     ELSE /\ apPaid' = (IF Fixed THEN apPaid ELSE snap[q]) + a
          /\ apRows' = apRows + a
          /\ usedNo' = usedNo \cup {myNo[q]} /\ lastNo' = myNo[q]
  /\ Done(q)
  /\ UNCHANGED <<arPaid, arRows, arStatus, wasVoided, myNo>>

\* payments/batch/route.ts:175-252 (numbers never collide).
CommitApBatch(q) ==
  /\ pc[q] = "ApBatch"
  /\ LET a == arg[q] IN
     IF Fixed /\ apPaid + a > Total
     THEN UNCHANGED <<apPaid, apRows>>
     ELSE apPaid' = (IF Fixed THEN apPaid ELSE snap[q]) + a /\ apRows' = apRows + a
  /\ Done(q)
  /\ UNCHANGED <<arPaid, arRows, arStatus, wasVoided, usedNo, lastNo, myNo>>

Init ==
  /\ arPaid = 0 /\ arRows = 0 /\ arStatus = "pending" /\ wasVoided = FALSE
  /\ apPaid = 0 /\ apRows = 0 /\ usedNo = {} /\ lastNo = 0
  /\ pc = [q \in Reqs |-> "idle"] /\ arg = [q \in Reqs |-> 0]
  /\ snap = [q \in Reqs |-> 0] /\ myNo = [q \in Reqs |-> 0]

Next ==
  \/ \E q \in Reqs : Start(q) \/ ApNumber(q) \/ CommitArPay(q) \/ CommitVoid(q)
                     \/ CommitApPay(q) \/ CommitApBatch(q)
  \/ (\A q \in Reqs : pc[q] = "done") /\ UNCHANGED vars

Spec == Init /\ [][Next]_vars

Idle == \A q \in Reqs : pc[q] \in {"idle", "done"}

ArNoOverpay     == arPaid <= Total
ArVoidStaysVoid == wasVoided => arStatus = "voided"
ArStatusMatches == (Idle /\ arStatus # "voided") => ((arStatus = "completed") = (arPaid >= Total))
ApPaidIsSum     == Idle => apPaid = apRows
ApNoOverpay     == apRows <= Total
=============================================================================
