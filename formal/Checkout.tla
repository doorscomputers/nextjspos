------------------------------ MODULE Checkout ------------------------------
(***************************************************************************)
(* One POS checkout (one cart, one cartSessionId) sent several times with  *)
(* the SAME Idempotency-Key: double click, apiPost retries after a         *)
(* timeout, the offline queue replaying it. The key comes from             *)
(* src/lib/client/apiClient.ts:18-55 (cart + cartSessionId + date), so     *)
(* every attempt of this checkout carries the same key.                    *)
(*                                                                         *)
(* PROPERTY: the checkout creates at most one sale, so its items are       *)
(* deducted from stock at most once.                                       *)
(*                                                                         *)
(* Server side is src/lib/idempotency.ts withIdempotency():                *)
(*   claim  = INSERT ... ON CONFLICT (key) DO NOTHING RETURNING id (line 66)*)
(*   handler= POST /api/sales; its prisma.$transaction (sales/route.ts:1081)*)
(*            creates the sale and deducts stock in one atomic step        *)
(*   mark   = markKeyCompleted (line 97)                                   *)
(*   'processing' key older than 180s = stale -> DELETE and run again      *)
(*            (lines 140-165)                                              *)
(* The sales handler catches every error and returns a response            *)
(* (sales/route.ts:1505), so the 'failed' key path is never taken.         *)
(*                                                                         *)
(* ASSUMPTION (from the 180s comment, idempotency.ts:134-139): a key only  *)
(* goes stale after the request that owns it has stopped (maxDuration 120s *)
(* for /api/sales in vercel.json).                                         *)
(*                                                                         *)
(* CONSTANT KillAfterCommit: TRUE lets Vercel stop a function between the  *)
(* sale commit and markKeyCompleted (timeout at maxDuration, crash,        *)
(* deploy). FALSE = that never happens.                                    *)
(***************************************************************************)
EXTENDS Naturals

CONSTANTS Attempts, KillAfterCommit

VARIABLES key,    \* "none" | "processing" | "completed"
          stale,  \* the processing key is older than 180s
          sales,  \* sales created by this checkout
          pc      \* per attempt: "idle" | "claimed" | "committed" | "done" | "dead"

vars == <<key, stale, sales, pc>>

OwnerAlive == \E a \in Attempts : pc[a] \in {"claimed", "committed"}

Try(a) ==
  /\ pc[a] = "idle"
  /\ CASE key = "none"
            -> key' = "processing" /\ stale' = FALSE /\ pc' = [pc EXCEPT ![a] = "claimed"]
       [] key = "processing" /\ stale
            -> key' = "none" /\ stale' = FALSE /\ UNCHANGED pc   \* DELETE stale, then retry (recursive call)
       [] key = "processing" /\ ~stale
            -> UNCHANGED <<key, stale>> /\ pc' = [pc EXCEPT ![a] = "done"]   \* 429
       [] key = "completed"
            -> UNCHANGED <<key, stale>> /\ pc' = [pc EXCEPT ![a] = "done"]   \* replay cached sale
  /\ UNCHANGED sales

Commit(a) ==      \* the sale transaction commits: stock deducted
  /\ pc[a] = "claimed"
  /\ sales' = sales + 1
  /\ pc' = [pc EXCEPT ![a] = "committed"]
  /\ UNCHANGED <<key, stale>>

KillBeforeCommit(a) ==   \* transaction rolls back; nothing deducted
  /\ pc[a] = "claimed"
  /\ pc' = [pc EXCEPT ![a] = "dead"]
  /\ UNCHANGED <<key, stale, sales>>

Mark(a) ==
  /\ pc[a] = "committed"
  /\ key' = "completed"
  /\ pc' = [pc EXCEPT ![a] = "done"]
  /\ UNCHANGED <<stale, sales>>

KillAfter(a) ==
  /\ KillAfterCommit
  /\ pc[a] = "committed"
  /\ pc' = [pc EXCEPT ![a] = "dead"]
  /\ UNCHANGED <<key, stale, sales>>

Age ==            \* 180 seconds pass with nobody alive holding the key
  /\ key = "processing" /\ ~stale /\ ~OwnerAlive
  /\ stale' = TRUE
  /\ UNCHANGED <<key, sales, pc>>

Init == key = "none" /\ stale = FALSE /\ sales = 0 /\ pc = [a \in Attempts |-> "idle"]

Next ==
  \/ \E a \in Attempts : Try(a) \/ Commit(a) \/ KillBeforeCommit(a) \/ Mark(a) \/ KillAfter(a)
  \/ Age
  \/ UNCHANGED vars

Spec == Init /\ [][Next]_vars

NoDoubleSaleDeduction == sales <= 1
=============================================================================
