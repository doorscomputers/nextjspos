------------------------------ MODULE Receiving ------------------------------
(***************************************************************************)
(* PART A - Receiving from a supplier (GRN).                               *)
(* One purchase order line of `Ordered` units. Staff create GRNs           *)
(* (purchases/[id]/receive/route.ts) and a manager approves them           *)
(* (purchases/receipts/[id]/approve/route.ts), which adds the stock.       *)
(*                                                                         *)
(* PART B - Every other "approve once" stock document. Each is a pending   *)
(* document whose approve route claims it with a guarded updateMany and    *)
(* posts stock in the same transaction:                                    *)
(*   supplier-returns/[id]/approve/route.ts:147   (stock out)              *)
(*   purchases/returns/[id]/approve/route.ts:115  (stock out)              *)
(*   customer-returns/[id]/issue-replacement/route.ts:148 (stock out)      *)
(*                                                                         *)
(* PROPERTIES                                                              *)
(*   NoDoubleGrnApprove   - one GRN adds its stock at most once.           *)
(*   NoOverReceive        - stock received on a PO line never exceeds what *)
(*                          was ordered (the same delivery is not received *)
(*                          twice).                                        *)
(*   NoDoubleDocPosting   - each Part B document moves stock at most once. *)
(*                                                                         *)
(* Request = step 1 (reads outside the transaction, kept in `snap`) then   *)
(* step 2 (the transaction, one atomic step). See TransferStock.tla.       *)
(***************************************************************************)
EXTENDS Naturals, FiniteSets

CONSTANTS Reqs, Grns, Ordered, OtherDocs,
          OneAtATime  \* TRUE = no two requests overlap

VARIABLES grnStatus,   \* purchase_receipts.status: "none"|"pending"|"approved"
          grnQty,
          qtyReceived, \* purchase_items.quantity_received (updated on approve, approve/route.ts:575-585)
          stockIn,     \* units added to stock by GRN approvals
          grnPosts,    \* per GRN: how many times its stock was added
          docStatus,   \* Part B: "pending" | "approved"
          docPosts,    \* Part B: postings per document
          pc, arg, snap

vars == <<grnStatus, grnQty, qtyReceived, stockIn, grnPosts, docStatus, docPosts, pc, arg, snap>>

Now == [pendingGrn |-> \E g \in Grns : grnStatus[g] = "pending", received |-> qtyReceived]

PreOK(r, x, n) ==
  CASE r = "CreateGrn"  -> /\ grnStatus[x] = "none"          \* x = slot the new GRN will use
                           /\ ~Now.pendingGrn                 \* receive/route.ts:95-114
                           /\ Now.received + n <= Ordered     \* receive/route.ts:139-150
    [] r = "ApproveGrn" -> grnStatus[x] = "pending"           \* approve/route.ts:269
    [] r = "ApproveDoc" -> docStatus[x] = "pending"           \* each route's status check

Start(q) ==
  /\ pc[q] = "idle"
  /\ OneAtATime => \A p \in Reqs : pc[p] \in {"idle", "done"}
  /\ \E r \in {"CreateGrn", "ApproveGrn", "ApproveDoc"}, x \in Grns \cup OtherDocs, n \in 1..Ordered :
       /\ (r = "ApproveDoc") = (x \in OtherDocs)
       /\ IF PreOK(r, x, n)
          THEN pc' = [pc EXCEPT ![q] = r] /\ arg' = [arg EXCEPT ![q] = <<x, n>>]
               /\ snap' = [snap EXCEPT ![q] = Now]
          ELSE pc' = [pc EXCEPT ![q] = "done"] /\ UNCHANGED <<arg, snap>>
  /\ UNCHANGED <<grnStatus, grnQty, qtyReceived, stockIn, grnPosts, docStatus, docPosts>>

Done(q) == pc' = [pc EXCEPT ![q] = "done"] /\ UNCHANGED <<arg, snap>>

\* receive/route.ts transaction: SELECT ... FROM purchases FOR UPDATE, then re-check
\* "no pending GRN" and quantityReceived + n <= ordered, then create as 'pending'.
CommitCreate(q) ==
  /\ pc[q] = "CreateGrn"
  /\ LET g == arg[q][1] IN
       IF /\ grnStatus[g] = "none"
          /\ ~\E h \in Grns : grnStatus[h] = "pending"
          /\ qtyReceived + arg[q][2] <= Ordered
       THEN grnStatus' = [grnStatus EXCEPT ![g] = "pending"] /\ grnQty' = [grnQty EXCEPT ![g] = arg[q][2]]
       ELSE UNCHANGED <<grnStatus, grnQty>>
  /\ Done(q)
  /\ UNCHANGED <<qtyReceived, stockIn, grnPosts, docStatus, docPosts>>

\* approve/route.ts transaction: claim notIn approved/rejected -> approved, then
\* SELECT ... FROM purchases FOR UPDATE and quantityReceived + this GRN <= ordered
\* (else the whole transaction rolls back), add stock, raise quantityReceived.
CommitApprove(q) ==
  /\ pc[q] = "ApproveGrn"
  /\ LET g == arg[q][1] IN
       IF grnStatus[g] = "pending" /\ qtyReceived + grnQty[g] <= Ordered
       THEN /\ grnStatus' = [grnStatus EXCEPT ![g] = "approved"]
            /\ stockIn' = stockIn + grnQty[g]
            /\ qtyReceived' = qtyReceived + grnQty[g]
            /\ grnPosts' = [grnPosts EXCEPT ![g] = @ + 1]
       ELSE UNCHANGED <<grnStatus, stockIn, qtyReceived, grnPosts>>
  /\ Done(q)
  /\ UNCHANGED <<grnQty, docStatus, docPosts>>

\* Part B: updateMany({ where: { id, status: 'pending' } }) (or replacementIssued: false)
CommitDoc(q) ==
  /\ pc[q] = "ApproveDoc"
  /\ LET d == arg[q][1] IN
       IF docStatus[d] = "pending"
       THEN docStatus' = [docStatus EXCEPT ![d] = "approved"] /\ docPosts' = [docPosts EXCEPT ![d] = @ + 1]
       ELSE UNCHANGED <<docStatus, docPosts>>
  /\ Done(q)
  /\ UNCHANGED <<grnStatus, grnQty, qtyReceived, stockIn, grnPosts>>

Init ==
  /\ grnStatus = [g \in Grns |-> "none"] /\ grnQty = [g \in Grns |-> 0]
  /\ qtyReceived = 0 /\ stockIn = 0 /\ grnPosts = [g \in Grns |-> 0]
  /\ docStatus = [d \in OtherDocs |-> "pending"] /\ docPosts = [d \in OtherDocs |-> 0]
  /\ pc = [q \in Reqs |-> "idle"]
  /\ arg = [q \in Reqs |-> <<CHOOSE g \in Grns : TRUE, 1>>]
  /\ snap = [q \in Reqs |-> Now]

Next ==
  \/ \E q \in Reqs : Start(q) \/ CommitCreate(q) \/ CommitApprove(q) \/ CommitDoc(q)
  \/ (\A q \in Reqs : pc[q] = "done") /\ UNCHANGED vars

Spec == Init /\ [][Next]_vars

NoDoubleGrnApprove == \A g \in Grns : grnPosts[g] <= 1
NoOverReceive      == stockIn <= Ordered
NoDoubleDocPosting == \A d \in OtherDocs : docPosts[d] <= 1
=============================================================================
