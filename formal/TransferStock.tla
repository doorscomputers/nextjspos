---------------------------- MODULE TransferStock ----------------------------
(***************************************************************************)
(* One stock transfer, every HTTP route and background job that can touch  *)
(* it, and any number of those requests running at the same time.         *)
(*                                                                         *)
(* PROPERTY: the goods on one transfer leave the origin branch at most     *)
(* once, arrive at the destination at most once, are put back at the      *)
(* origin at most once, are never both at the destination AND put back    *)
(* at the origin, and a cancelled transfer that had left is put back.      *)
(*                                                                         *)
(* HOW A REQUEST IS MODELLED (true to the code):                           *)
(*   Step 1 "Pre"   = the findUnique + status checks at the top of the     *)
(*                    route. Runs OUTSIDE any transaction, so it can read  *)
(*                    a value that is stale by the time step 2 runs.       *)
(*   Step 2 "Commit"= the prisma.$transaction (or the single update).      *)
(*                    The guarded tx.stockTransfer.updateMany(...) takes   *)
(*                    the transfer row lock and re-checks its WHERE on the *)
(*                    latest committed row (PostgreSQL READ COMMITTED),    *)
(*                    and everything in the transaction commits together,  *)
(*                    so the whole transaction is ONE atomic step. Values  *)
(*                    the code takes from the step-1 read are taken from   *)
(*                    the snapshot `snap`, exactly as the code does.       *)
(*                                                                         *)
(* Stock is counted, not valued: one posting = one unit of the transfer.   *)
(* Balance arithmetic itself is server-side under SELECT ... FOR UPDATE    *)
(* (database/functions/update_inventory_with_history_v3_schema_fix.sql,    *)
(* confirmed live on 2026-11-23), so it is assumed correct here.           *)
(***************************************************************************)
EXTENDS Naturals, FiniteSets

CONSTANTS Reqs,         \* concurrent HTTP requests / jobs, e.g. {r1, r2, r3}
          Routes,       \* which routes are deployed (see cfg)
          InitDeducted  \* FALSE = normal

VARIABLES status,        \* stock_transfers.status
          stockDeducted, \* stock_transfers.stock_deducted
          stockReceived, \* stock_transfers.stock_received
          originOut,     \* TRANSFER_OUT postings at fromLocation
          originBack,    \* TRANSFER_CANCEL postings at fromLocation
          destIn,        \* TRANSFER_IN postings at toLocation
          pc,            \* per request: "idle" | route name | "done"
          snap           \* per request: what its step-1 read saw

vars == <<status, stockDeducted, stockReceived, originOut, originBack, destIn, pc, snap>>

Row == [status : {"checked","in_transit","arrived","verifying","verified",
                  "received","completed","cancelled"},
        deducted : BOOLEAN, received : BOOLEAN]

Now == [status |-> status, deducted |-> stockDeducted, received |-> stockReceived]

\* Status sets copied from the code.
ReceiveOK  == {"in_transit", "arrived", "verifying"}             \* receive/route.ts:142
CompleteOK == {"in_transit", "arrived", "verified", "verifying"} \* complete/route.ts:83-86, job-processor.ts:569
VerifyOK   == {"in_transit", "verifying", "arrived"}             \* verify-all/route.ts:70

\* ---------- Step 1: the unguarded read + early return checks ----------
PreOK(r, row) ==
  CASE r = "SendSync"      -> row.status = "checked"                      \* send/route.ts:74
    [] r = "SendJob"       -> row.status = "checked" /\ ~row.deducted     \* send-async/route.ts:58,66 ; job-processor.ts:425-432
    [] r = "Receive"       -> row.status \in ReceiveOK                    \* receive/route.ts:143
    [] r = "CompleteSync"  -> row.status \in CompleteOK                   \* complete/route.ts:88
    [] r = "CompleteJob"   -> row.status \in CompleteOK /\ ~row.received  \* complete-async/route.ts:69 ; job-processor.ts:560-572
    [] r = "Cancel"        -> row.status \notin {"completed", "cancelled", "received"}
                              /\ ~row.received                            \* cancel/route.ts:75-97
    [] r = "MarkArrived"   -> row.status = "in_transit"                   \* mark-arrived/route.ts:63
    [] r = "StartVerify"   -> row.status = "arrived"                      \* start-verification/route.ts:56
    [] r = "VerifyAll"     -> row.status \in VerifyOK                     \* verify-all/route.ts:70
    [] r = "VerifyItem"    -> row.status = "verifying"                    \* verify-item/route.ts:74
    [] r = "UnverifyItem"  -> row.status = "verified"                     \* unverify-item/route.ts:67-75,111 (only acts when verified)

Start(q) ==
  /\ pc[q] = "idle"
  /\ \E r \in Routes :
       IF PreOK(r, Now)
       THEN /\ pc'   = [pc EXCEPT ![q] = r]
            /\ snap' = [snap EXCEPT ![q] = Now]
       ELSE /\ pc'   = [pc EXCEPT ![q] = "done"]      \* 400 response, nothing written
            /\ UNCHANGED snap
  /\ UNCHANGED <<status, stockDeducted, stockReceived, originOut, originBack, destIn>>

Finish(q) == pc' = [pc EXCEPT ![q] = "done"] /\ UNCHANGED snap

\* ---------- Step 2: the transaction ----------

\* send/route.ts:205-266 and job-processor.ts:456-523 (same claim, same effects)
CommitSend(q) ==
  /\ pc[q] \in {"SendSync", "SendJob"}
  /\ IF status = "checked" /\ ~stockDeducted                  \* claim WHERE
     THEN /\ status' = "in_transit" /\ stockDeducted' = TRUE
          /\ originOut' = originOut + 1
     ELSE UNCHANGED <<status, stockDeducted, originOut>>       \* count 0 -> 409
  /\ Finish(q)
  /\ UNCHANGED <<stockReceived, originBack, destIn>>

\* receive/route.ts:249-346. deductAtReceive comes from the step-1 read (line 264).
CommitReceive(q) ==
  /\ pc[q] = "Receive"
  /\ IF status \in ReceiveOK /\ ~stockReceived                \* claim WHERE, line 250
     THEN /\ status' = "received" /\ stockDeducted' = TRUE     \* lines 252-253
          /\ stockReceived' = TRUE                             \* line 254
          /\ originOut' = IF ~snap[q].deducted THEN originOut + 1 ELSE originOut
          /\ destIn' = destIn + 1                              \* transferStockIn
     ELSE UNCHANGED <<status, stockDeducted, stockReceived, originOut, destIn>>
  /\ Finish(q)
  /\ UNCHANGED originBack

\* complete/route.ts:177-263 (sync)
CommitCompleteSync(q) ==
  /\ pc[q] = "CompleteSync"
  /\ IF status \in CompleteOK /\ ~stockReceived               \* claim WHERE, lines 181-182
     THEN /\ status' = "completed" /\ stockReceived' = TRUE    \* line 184
          /\ destIn' = destIn + 1                              \* addStock
     ELSE UNCHANGED <<status, stockReceived, destIn>>
  /\ Finish(q)
  /\ UNCHANGED <<stockDeducted, originOut, originBack>>

\* job-processor.ts:595-726
CommitCompleteJob(q) ==
  /\ pc[q] = "CompleteJob"
  /\ IF status \in CompleteOK /\ ~stockReceived                \* claim WHERE, line 598
     THEN /\ stockReceived' = TRUE /\ status' = "completed"
          /\ destIn' = destIn + 1
     ELSE UNCHANGED <<status, stockReceived, destIn>>
  /\ Finish(q)
  /\ UNCHANGED <<stockDeducted, originOut, originBack>>

\* cancel/route.ts:100-175. The restore decision is re-read under the row lock
\* (findUnique after the claim), so it uses the current stockDeducted.
CommitCancel(q) ==
  /\ pc[q] = "Cancel"
  /\ IF status \notin {"completed", "cancelled", "received"} /\ ~stockReceived  \* claim WHERE
     THEN /\ status' = "cancelled"
          /\ originBack' = IF stockDeducted THEN originBack + 1 ELSE originBack
     ELSE UNCHANGED <<status, originBack>>
  /\ Finish(q)
  /\ UNCHANGED <<stockDeducted, stockReceived, originOut, destIn>>

\* Status-only routes. Each is updateMany({ where: { id, status: <what it checked> } }):
\* mark-arrived, start-verification, verify-all, verify-item (when all items
\* are verified), unverify-item.
From(r) == CASE r = "MarkArrived"  -> {"in_transit"}
             [] r = "StartVerify"  -> {"arrived"}
             [] r = "VerifyAll"    -> VerifyOK
             [] r = "VerifyItem"   -> {"verifying"}
             [] r = "UnverifyItem" -> {"verified"}
To(r) == CASE r = "MarkArrived"  -> "arrived"
           [] r = "StartVerify"  -> "verifying"
           [] r = "VerifyAll"    -> "verified"
           [] r = "VerifyItem"   -> "verified"
           [] r = "UnverifyItem" -> "verifying"

CommitPlainStatus(q) ==
  /\ pc[q] \in {"MarkArrived", "StartVerify", "VerifyAll", "VerifyItem", "UnverifyItem"}
  /\ status' = IF status \in From(pc[q]) THEN To(pc[q]) ELSE status   \* count 0 -> 409 / no-op
  /\ Finish(q)
  /\ UNCHANGED <<stockDeducted, stockReceived, originOut, originBack, destIn>>

Init ==
  /\ status = "checked" /\ stockDeducted = InitDeducted /\ stockReceived = FALSE
  /\ originOut = 0 /\ originBack = 0 /\ destIn = 0
  /\ pc = [q \in Reqs |-> "idle"]
  /\ snap = [q \in Reqs |-> Now]

Next ==
  \/ \E q \in Reqs : Start(q) \/ CommitSend(q) \/ CommitReceive(q)
                     \/ CommitCompleteSync(q) \/ CommitCompleteJob(q)
                     \/ CommitCancel(q) \/ CommitPlainStatus(q)
  \/ (\A q \in Reqs : pc[q] = "done") /\ UNCHANGED vars   \* all requests answered

Spec == Init /\ [][Next]_vars

TypeOK ==
  /\ Now \in Row
  /\ originOut \in Nat /\ originBack \in Nat /\ destIn \in Nat

\* ======================= THE PROPERTIES =======================
\* "Transfer out should never be lessened twice"
NoDoubleTransferOut  == originOut <= 1
\* "Receiving via transfer in should never be added twice"
NoDoubleTransferIn   == destIn <= 1
\* A cancelled transfer puts the goods back at most once
NoDoubleCancelReturn == originBack <= 1
\* The same goods are never both at the destination AND back at the origin
NoStockFromNothing   == destIn + originBack <= originOut
\* A cancelled transfer that had left the origin is put back (nothing lost)
NoLostOnCancel       == status = "cancelled" => originBack = originOut
=============================================================================
