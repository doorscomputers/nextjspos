----------------------------- MODULE Corrections -----------------------------
(***************************************************************************)
(* Inventory corrections for ONE product at ONE branch.                    *)
(* A correction records a physical count. Approving it sets branch stock   *)
(* to that count. Routes (src/app/api/inventory-corrections/):             *)
(*   Approve  [id]/approve/route.ts  and  bulk-approve/route.ts            *)
(*            (bulk runs one transaction per correction, same steps)       *)
(*   Reject   [id]/reject/route.ts                                         *)
(*   Edit     [id]/route.ts PUT    (changes physicalCount)                 *)
(*   Delete   [id]/route.ts DELETE and bulk-delete/route.ts (soft delete)  *)
(*                                                                         *)
(* PROPERTIES                                                              *)
(*   DecisionFinal       - once approved or rejected, it stays that way.   *)
(*   OnlyLiveApprovedPost- stock is moved only by a correction that ends   *)
(*                         approved and not deleted, and at most once.     *)
(*   RecordMatchesStock  - the count shown on an approved correction is    *)
(*                         the count that was posted to stock.             *)
(*   StockIsLastCount    - when nothing is in flight, branch stock equals  *)
(*                         the count of the last approved correction.      *)
(*                                                                         *)
(* Request = step 1 (reads outside the transaction, kept in `snap`) then   *)
(* the transaction. Approve's transaction is TWO steps, true to the code:  *)
(*   Claim: updateMany status<>'approved' (row lock on the correction) and *)
(*          getCurrentStock - a plain read, no lock (stockOperations.ts    *)
(*          298-323), so another transaction can commit after it.          *)
(*   Post:  updateStock(quantity = count - seen) -> the stock function     *)
(*          adds that difference to the LATEST locked balance; commit.     *)
(***************************************************************************)
EXTENDS Integers, FiniteSets

CONSTANTS Reqs, Cs, Counts, Start0,
          OneAtATime,     \* TRUE = no two requests overlap
          FixedClaim      \* TRUE = the guards a fix would add (see Fix* below)

VARIABLES status,        \* inventory_corrections.status: "pending"|"approved"|"rejected"
          deleted,       \* deletedAt IS NOT NULL
          count,         \* physicalCount
          stock,         \* variation_location_details.qty_available
          posts,         \* times this correction moved stock
          postedCount,   \* the count it set stock to
          lastSet,       \* count of the last approval that posted (or Start0)
          firstDecision, \* first final status it ever had ("none" until then)
          lockC,         \* request holding the correction row lock (uncommitted claim)
          pc, arg, snap, seen

vars == <<status, deleted, count, stock, posts, postedCount, lastSet, firstDecision, lockC, pc, arg, snap, seen>>

NoLock == "none"

Kinds == {"Approve", "Reject", "Edit", "Delete"}

\* Pre-checks outside the transaction (all routes first do findFirst ... deletedAt: null).
PreOK(r, c) ==
  /\ ~deleted[c]
  /\ CASE r = "Approve" -> status[c] # "approved"                   \* approve/route.ts:79
       [] r = "Reject"  -> status[c] \notin {"approved", "rejected"} \* reject/route.ts:82,88
       [] r = "Edit"    -> status[c] # "approved"                   \* [id]/route.ts:143
       [] r = "Delete"  -> status[c] # "approved"                   \* [id]/route.ts:281, bulk-delete:80

Start(q) ==
  /\ pc[q] = "idle"
  /\ OneAtATime => \A p \in Reqs : pc[p] \in {"idle", "done"}
  /\ \E r \in Kinds, c \in Cs, n \in Counts :
       /\ (r # "Edit") => n = Start0          \* n only matters for Edit
       /\ IF PreOK(r, c)
          THEN pc' = [pc EXCEPT ![q] = r] /\ arg' = [arg EXCEPT ![q] = <<c, n>>]
               /\ snap' = [snap EXCEPT ![q] = count[c]]     \* approve/route.ts:91 physicalCount
          ELSE pc' = [pc EXCEPT ![q] = "done"] /\ UNCHANGED <<arg, snap>>
  /\ UNCHANGED <<status, deleted, count, stock, posts, postedCount, lastSet, firstDecision, lockC, seen>>

Done(q) == pc' = [pc EXCEPT ![q] = "done"] /\ UNCHANGED <<arg, snap>>
Free(c, q) == lockC[c] \in {NoLock, q}     \* a write on the row waits for the row lock

Decide(c, s) == firstDecision' = [firstDecision EXCEPT ![c] = IF @ = "none" THEN s ELSE @]

\* approve/route.ts:95-101 (bulk-approve 115-121): updateMany where status <> 'approved'.
\* FixedClaim adds: status = 'pending' AND deletedAt IS NULL.
ClaimOK(c) == IF FixedClaim THEN status[c] = "pending" /\ ~deleted[c] ELSE status[c] # "approved"

CommitClaim(q) ==
  /\ pc[q] = "Approve"
  /\ LET c == arg[q][1] IN
     /\ Free(c, q)
     /\ IF ClaimOK(c)
        THEN /\ lockC' = [lockC EXCEPT ![c] = q]
             /\ seen' = [seen EXCEPT ![q] = stock]              \* getCurrentStock, no lock
             /\ pc' = [pc EXCEPT ![q] = "Post"] /\ UNCHANGED <<arg, snap>>
        ELSE Done(q) /\ UNCHANGED <<lockC, seen>>
  /\ UNCHANGED <<status, deleted, count, stock, posts, postedCount, lastSet, firstDecision>>

\* updateStock -> update_inventory_with_history: FOR UPDATE, balance = latest + p_quantity.
\* FixedClaim: the difference is taken from the locked balance (stock), not the earlier read.
CommitPost(q) ==
  /\ pc[q] = "Post"
  /\ LET c == arg[q][1]
         p == IF FixedClaim THEN count[c] ELSE snap[q]
         base == IF FixedClaim THEN stock ELSE seen[q] IN
     /\ stock' = stock + (p - base)
     /\ status' = [status EXCEPT ![c] = "approved"]
     /\ posts' = [posts EXCEPT ![c] = @ + 1]
     /\ postedCount' = [postedCount EXCEPT ![c] = p]
     /\ lastSet' = p
     /\ Decide(c, "approved")
     /\ lockC' = [lockC EXCEPT ![c] = NoLock]
  /\ Done(q)
  /\ UNCHANGED <<deleted, count, seen>>

\* reject/route.ts:102 prisma.inventoryCorrection.update({ where: { id } }) - no status, no transaction.
\* FixedClaim: updateMany where status = 'pending' AND deletedAt IS NULL.
CommitReject(q) ==
  /\ pc[q] = "Reject"
  /\ LET c == arg[q][1] IN
     /\ Free(c, q)
     /\ IF ~FixedClaim \/ (status[c] = "pending" /\ ~deleted[c])
        THEN status' = [status EXCEPT ![c] = "rejected"] /\ Decide(c, "rejected")
        ELSE UNCHANGED <<status, firstDecision>>
  /\ Done(q)
  /\ UNCHANGED <<deleted, count, stock, posts, postedCount, lastSet, lockC, seen>>

\* [id]/route.ts:170 update({ where: { id } }) sets physicalCount.
CommitEdit(q) ==
  /\ pc[q] = "Edit"
  /\ LET c == arg[q][1] IN
     /\ Free(c, q)
     /\ IF ~FixedClaim \/ (status[c] = "pending" /\ ~deleted[c])
        THEN count' = [count EXCEPT ![c] = arg[q][2]]
        ELSE UNCHANGED count
  /\ Done(q)
  /\ UNCHANGED <<status, deleted, stock, posts, postedCount, lastSet, firstDecision, lockC, seen>>

\* [id]/route.ts:288 and bulk-delete/route.ts:98 update({ where: { id } }) sets deletedAt.
CommitDelete(q) ==
  /\ pc[q] = "Delete"
  /\ LET c == arg[q][1] IN
     /\ Free(c, q)
     /\ IF ~FixedClaim \/ status[c] # "approved"
        THEN deleted' = [deleted EXCEPT ![c] = TRUE]
        ELSE UNCHANGED deleted
  /\ Done(q)
  /\ UNCHANGED <<status, count, stock, posts, postedCount, lastSet, firstDecision, lockC, seen>>

Init ==
  /\ status = [c \in Cs |-> "pending"] /\ deleted = [c \in Cs |-> FALSE]
  /\ count \in [Cs -> Counts]
  /\ stock = Start0 /\ posts = [c \in Cs |-> 0] /\ postedCount = [c \in Cs |-> Start0]
  /\ lastSet = Start0 /\ firstDecision = [c \in Cs |-> "none"] /\ lockC = [c \in Cs |-> NoLock]
  /\ pc = [q \in Reqs |-> "idle"]
  /\ arg = [q \in Reqs |-> <<CHOOSE c \in Cs : TRUE, Start0>>]
  /\ snap = [q \in Reqs |-> Start0] /\ seen = [q \in Reqs |-> Start0]

Next ==
  \/ \E q \in Reqs : Start(q) \/ CommitClaim(q) \/ CommitPost(q) \/ CommitReject(q)
                     \/ CommitEdit(q) \/ CommitDelete(q)
  \/ (\A q \in Reqs : pc[q] = "done") /\ UNCHANGED vars

Spec == Init /\ [][Next]_vars

Idle == \A q \in Reqs : pc[q] \in {"idle", "done"}

DecisionFinal        == \A c \in Cs : firstDecision[c] # "none" => status[c] = firstDecision[c]
OnlyLiveApprovedPost == \A c \in Cs : posts[c] > 0 => (posts[c] = 1 /\ status[c] = "approved" /\ ~deleted[c])
RecordMatchesStock   == \A c \in Cs : posts[c] > 0 /\ status[c] = "approved" => count[c] = postedCount[c]
StockIsLastCount     == Idle => stock = lastSet
=============================================================================
