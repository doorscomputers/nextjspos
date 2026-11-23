----------------------------- MODULE SaleReturns -----------------------------
(***************************************************************************)
(* One completed sale of `Sold` units of one product, and every route that *)
(* can put those sold units back into stock: void (both routes), exchange  *)
(* (return leg), and customer return (create, then approve). Any number of *)
(* these requests may run at the same time, by the same or different staff.*)
(*                                                                         *)
(* PROPERTY: units put back into stock for a sale never exceed the units   *)
(* that sale took out. ("Return from customer / exchange / void should     *)
(* never be a double add.")                                                *)
(*                                                                         *)
(* Request = Step 1 "Pre" (reads + checks OUTSIDE the transaction) then    *)
(* Step 2 "Commit" (the prisma.$transaction, one atomic step). See         *)
(* TransferStock.tla for why a transaction is one step. Every commit below *)
(* starts with SELECT ... FROM sales WHERE id = ... FOR UPDATE, so the     *)
(* checks inside it see the latest committed sale and returns.             *)
(*                                                                         *)
(* Left out: the 5-minute "same user, identical items" duplicate checks    *)
(* (exchange/route.ts:219, customer-returns/route.ts:244). They only stop  *)
(* the SAME user repeating the SAME items within 5 minutes, so the model   *)
(* lets different staff (or a later retry) act - which the code allows.   *)
(* Non-resellable return items (no stock change) are left out; they count  *)
(* against the sold quantity in the code too, which only makes it stricter.*)
(***************************************************************************)
EXTENDS Naturals, FiniteSets

CONSTANTS Reqs, Docs, Sold,
          OneAtATime  \* TRUE = no two requests overlap

VARIABLES saleStatus,  \* sales.status: "completed" | "voided"
          docStatus,   \* customer_returns.status per return slot: "none"|"pending"|"approved"|"exchanged"
          docQty,      \* quantity on that return
          restored,    \* units added back to stock for this sale
          pc, arg

vars == <<saleStatus, docStatus, docQty, restored, pc, arg>>

Qty == 1..Sold
\* status notIn ('rejected','cancelled','voided') - every return that still counts
Active(d) == docStatus[d] \in {"pending", "approved", "exchanged"}
RECURSIVE Sum(_)
Sum(S) == IF S = {} THEN 0 ELSE LET d == CHOOSE x \in S : TRUE IN docQty[d] + Sum(S \ {d})
CountedQty == Sum({d \in Docs : Active(d)})

\* ---------------- Step 1 (outside the transaction, current state) ----------------
\* arg[q] = <<return slot, quantity>>
PreOK(r, d, n) ==
  CASE r = "Void"     -> saleStatus /= "voided" /\ ~\E e \in Docs : Active(e)   \* void/route.ts:195, 254-274
                                                                               \* (sales/[id]/route.ts DELETE: status only)
    [] r = "Exchange" -> saleStatus /= "voided" /\ CountedQty + n <= Sold /\ docStatus[d] = "none"
                                                                               \* exchange/route.ts:116, 290-316
    [] r = "Create"   -> n <= Sold /\ docStatus[d] = "none"                    \* customer-returns/route.ts:198
    [] r = "Approve"  -> docStatus[d] = "pending"                              \* customer-returns/[id]/approve/route.ts:68

Start(q) ==
  /\ pc[q] = "idle"
  /\ OneAtATime => \A p \in Reqs : pc[p] \in {"idle", "done"}
  /\ \E r \in {"Void", "Exchange", "Create", "Approve"}, d \in Docs, n \in Qty :
       IF PreOK(r, d, n)
       THEN pc' = [pc EXCEPT ![q] = r] /\ arg' = [arg EXCEPT ![q] = <<d, n>>]
       ELSE pc' = [pc EXCEPT ![q] = "done"] /\ UNCHANGED arg
  /\ UNCHANGED <<saleStatus, docStatus, docQty, restored>>

Done(q) == pc' = [pc EXCEPT ![q] = "done"] /\ UNCHANGED arg

\* ---------------- Step 2 (the transaction, sale row locked) ----------------
\* void/route.ts and sales/[id]/route.ts DELETE: FOR UPDATE NOWAIT, status not voided,
\* tx.customerReturn.count(active) = 0, then addStock for every sold item.
CommitVoid(q) ==
  /\ pc[q] = "Void"
  /\ IF saleStatus /= "voided" /\ ~\E e \in Docs : Active(e)
     THEN saleStatus' = "voided" /\ restored' = restored + Sold
     ELSE UNCHANGED <<saleStatus, restored>>
  /\ Done(q) /\ UNCHANGED <<docStatus, docQty>>

\* exchange/route.ts transaction: FOR UPDATE on the sale, not voided/cancelled,
\* earlier returns (notIn rejected/voided) + this one <= sold; then the return
\* (status 'exchanged') and addStock.
CommitExchange(q) ==
  /\ pc[q] = "Exchange"
  /\ LET d == arg[q][1]  n == arg[q][2] IN
       IF docStatus[d] = "none" /\ saleStatus /= "voided" /\ CountedQty + n <= Sold
       THEN /\ docStatus' = [docStatus EXCEPT ![d] = "exchanged"]
            /\ docQty' = [docQty EXCEPT ![d] = n]
            /\ restored' = restored + n
       ELSE UNCHANGED <<docStatus, docQty, restored>>
  /\ Done(q) /\ UNCHANGED saleStatus

\* customer-returns/route.ts transaction: FOR UPDATE on the sale, not voided/cancelled,
\* earlier active returns + this one <= sold; creates the return as 'pending'. No stock yet.
CommitCreate(q) ==
  /\ pc[q] = "Create"
  /\ LET d == arg[q][1]  n == arg[q][2] IN
       IF docStatus[d] = "none" /\ saleStatus /= "voided" /\ CountedQty + n <= Sold
       THEN docStatus' = [docStatus EXCEPT ![d] = "pending"] /\ docQty' = [docQty EXCEPT ![d] = n]
       ELSE UNCHANGED <<docStatus, docQty>>
  /\ Done(q) /\ UNCHANGED <<saleStatus, restored>>

\* customer-returns/[id]/approve/route.ts transaction: FOR UPDATE on the sale, not
\* voided/cancelled, all active returns (this pending one included) <= sold, then the
\* claim pending -> approved and addStock.
CommitApprove(q) ==
  /\ pc[q] = "Approve"
  /\ LET d == arg[q][1] IN
       IF docStatus[d] = "pending" /\ saleStatus /= "voided" /\ CountedQty <= Sold
       THEN docStatus' = [docStatus EXCEPT ![d] = "approved"] /\ restored' = restored + docQty[d]
       ELSE UNCHANGED <<docStatus, restored>>
  /\ Done(q) /\ UNCHANGED <<saleStatus, docQty>>

Init ==
  /\ saleStatus = "completed"
  /\ docStatus = [d \in Docs |-> "none"] /\ docQty = [d \in Docs |-> 0]
  /\ restored = 0
  /\ pc = [q \in Reqs |-> "idle"]
  /\ arg = [q \in Reqs |-> <<CHOOSE d \in Docs : TRUE, 1>>]

Next ==
  \/ \E q \in Reqs : Start(q) \/ CommitVoid(q) \/ CommitExchange(q) \/ CommitCreate(q) \/ CommitApprove(q)
  \/ (\A q \in Reqs : pc[q] = "done") /\ UNCHANGED vars

Spec == Init /\ [][Next]_vars

\* ======================= THE PROPERTY =======================
NoDoubleReturnToStock == restored <= Sold
=============================================================================
