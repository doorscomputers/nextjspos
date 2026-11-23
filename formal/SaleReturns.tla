----------------------------- MODULE SaleReturns -----------------------------
(***************************************************************************)
(* One completed sale of `Sold` units of one product, and every route that *)
(* can put those sold units back into stock: void, exchange (return leg),  *)
(* and customer return (create, then approve). Any number of these         *)
(* requests may run at the same time, by the same or different staff.     *)
(*                                                                         *)
(* PROPERTY: units put back into stock for a sale never exceed the units   *)
(* that sale took out. ("Return from customer / exchange / void should     *)
(* never be a double add.")                                                *)
(*                                                                         *)
(* Request = Step 1 "Pre" (reads + checks OUTSIDE the transaction) then    *)
(* Step 2 "Commit" (the prisma.$transaction, one atomic step). Values the  *)
(* code takes from step 1 come from `snap`. See TransferStock.tla for why  *)
(* a transaction is one step.                                              *)
(*                                                                         *)
(* CONSTANT LockSale models a PROPOSED FIX, not today's code:              *)
(*   FALSE = today's code.                                                 *)
(*   TRUE  = every commit first runs SELECT ... FROM sales WHERE id = ...  *)
(*           FOR UPDATE and re-checks sale status and the total already    *)
(*           returned inside the transaction, and return creation refuses *)
(*           voided sales and counts earlier returns.                      *)
(*                                                                         *)
(* Left out: the 5-minute "same user, identical items" duplicate checks    *)
(* (exchange/route.ts:219, customer-returns/route.ts:244). They only stop  *)
(* the SAME user repeating the SAME items within 5 minutes, so the model   *)
(* lets different staff (or a later retry) act - which the code allows.   *)
(* Non-resellable return items (no stock change) are left out.             *)
(***************************************************************************)
EXTENDS Naturals, FiniteSets

CONSTANTS Reqs, Docs, Sold, LockSale,
          OneAtATime  \* TRUE = no two requests overlap (shows bugs that need no race)

VARIABLES saleStatus,  \* sales.status: "completed" | "voided"
          docStatus,   \* customer_returns.status per return slot: "none"|"pending"|"approved"|"exchanged"
          docQty,      \* quantity on that return
          restored,    \* units added back to stock for this sale
          pc, snap, arg

vars == <<saleStatus, docStatus, docQty, restored, pc, snap, arg>>

Qty == 1..Sold
Active(d) == docStatus[d] \in {"pending", "approved", "exchanged"}       \* void/route.ts:257 notIn rejected/cancelled/voided
RECURSIVE Sum(_)
Sum(S) == IF S = {} THEN 0 ELSE LET d == CHOOSE x \in S : TRUE IN docQty[d] + Sum(S \ {d})
\* units already put back by returns of this sale
ReturnedQty == Sum({d \in Docs : docStatus[d] \in {"approved", "exchanged"}})
\* exchange/route.ts:290-296 counts every return of this sale not rejected/voided, pending included
CountedQty == Sum({d \in Docs : Active(d)})

Now == [sale |-> saleStatus, anyActive |-> \E d \in Docs : Active(d), counted |-> CountedQty]

\* ---------------- Step 1 ----------------
\* arg[q] = <<route, return slot, quantity>>
PreOK(r, d, n, s) ==
  CASE r = "Void"     -> s.sale /= "voided" /\ ~s.anyActive                    \* void/route.ts:195, 254-274
    [] r = "Exchange" -> s.sale /= "voided" /\ s.counted + n <= Sold /\ docStatus[d] = "none"
                                                                               \* exchange/route.ts:116, 305-316
    [] r = "Create"   -> n <= Sold /\ docStatus[d] = "none"                    \* customer-returns/route.ts:198 (per return, not cumulative; no voided check)
                         /\ (LockSale => s.sale /= "voided" /\ s.counted + n <= Sold)
    [] r = "Approve"  -> docStatus[d] = "pending"                              \* customer-returns/[id]/approve/route.ts:39

Start(q) ==
  /\ pc[q] = "idle"
  /\ OneAtATime => \A p \in Reqs : pc[p] \in {"idle", "done"}
  /\ \E r \in {"Void", "Exchange", "Create", "Approve"}, d \in Docs, n \in Qty :
       IF PreOK(r, d, n, Now)
       THEN pc' = [pc EXCEPT ![q] = r] /\ arg' = [arg EXCEPT ![q] = <<r, d, n>>]
            /\ snap' = [snap EXCEPT ![q] = Now]
       ELSE pc' = [pc EXCEPT ![q] = "done"] /\ UNCHANGED <<arg, snap>>
  /\ UNCHANGED <<saleStatus, docStatus, docQty, restored>>

Done(q) == pc' = [pc EXCEPT ![q] = "done"] /\ UNCHANGED <<snap, arg>>

\* ---------------- Step 2 ----------------
\* void/route.ts:279-345: SELECT ... FOR UPDATE NOWAIT on the sale, re-check status only,
\* then addStock for every sold item. Active returns were checked in step 1 only.
CommitVoid(q) ==
  /\ pc[q] = "Void"
  /\ IF saleStatus /= "voided" /\ (LockSale => ~Now.anyActive)
     THEN saleStatus' = "voided" /\ restored' = restored + Sold
     ELSE UNCHANGED <<saleStatus, restored>>
  /\ Done(q) /\ UNCHANGED <<docStatus, docQty>>

\* exchange/route.ts:398-460: creates the return (status 'exchanged') and addStock.
\* Does not lock or re-read the sale.
CommitExchange(q) ==
  /\ pc[q] = "Exchange"
  /\ LET d == arg[q][2]  n == arg[q][3] IN
       IF docStatus[d] = "none" /\ (LockSale => saleStatus /= "voided" /\ CountedQty + n <= Sold)
       THEN /\ docStatus' = [docStatus EXCEPT ![d] = "exchanged"]
            /\ docQty' = [docQty EXCEPT ![d] = n]
            /\ restored' = restored + n
       ELSE UNCHANGED <<docStatus, docQty, restored>>
  /\ Done(q) /\ UNCHANGED saleStatus

\* customer-returns/route.ts:350-400: creates the return as 'pending'. No stock yet.
CommitCreate(q) ==
  /\ pc[q] = "Create"
  /\ LET d == arg[q][2]  n == arg[q][3] IN
       IF docStatus[d] = "none" /\ (LockSale => saleStatus /= "voided" /\ CountedQty + n <= Sold)
       THEN docStatus' = [docStatus EXCEPT ![d] = "pending"] /\ docQty' = [docQty EXCEPT ![d] = n]
       ELSE UNCHANGED <<docStatus, docQty>>
  /\ Done(q) /\ UNCHANGED <<saleStatus, restored>>

\* customer-returns/[id]/approve/route.ts:81-110: claim pending -> approved, then addStock.
\* Does not look at the sale or at other returns.
CommitApprove(q) ==
  /\ pc[q] = "Approve"
  /\ LET d == arg[q][2] IN
       IF docStatus[d] = "pending" /\ (LockSale => saleStatus /= "voided"
                                        /\ ReturnedQty + docQty[d] <= Sold)
       THEN docStatus' = [docStatus EXCEPT ![d] = "approved"] /\ restored' = restored + docQty[d]
       ELSE UNCHANGED <<docStatus, restored>>
  /\ Done(q) /\ UNCHANGED <<saleStatus, docQty>>

Init ==
  /\ saleStatus = "completed"
  /\ docStatus = [d \in Docs |-> "none"] /\ docQty = [d \in Docs |-> 0]
  /\ restored = 0
  /\ pc = [q \in Reqs |-> "idle"]
  /\ snap = [q \in Reqs |-> Now]
  /\ arg = [q \in Reqs |-> <<"none", CHOOSE d \in Docs : TRUE, 1>>]

Next ==
  \/ \E q \in Reqs : Start(q) \/ CommitVoid(q) \/ CommitExchange(q) \/ CommitCreate(q) \/ CommitApprove(q)
  \/ (\A q \in Reqs : pc[q] = "done") /\ UNCHANGED vars

Spec == Init /\ [][Next]_vars

\* ======================= THE PROPERTY =======================
NoDoubleReturnToStock == restored <= Sold
=============================================================================
