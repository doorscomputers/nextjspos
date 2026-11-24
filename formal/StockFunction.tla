---------------------------- MODULE StockFunction ----------------------------
(***************************************************************************)
(* The database math that changes a stock balance, for ONE product at ONE *)
(* branch. Every stock route ends in one of these PostgreSQL functions:    *)
(*   update_inventory_with_history       (stockOperations.ts:632)          *)
(*   bulk_update_inventory_with_history  (stockOperations.ts:839)          *)
(* Source: database/functions/update_inventory_with_history_v3_schema_fix  *)
(* .sql and bulk_update_inventory_with_history.sql. Live definitions were  *)
(* checked on 2026-11-24 to have the same lock / balance / upsert text.    *)
(*                                                                         *)
(* Steps, true to the SQL (READ COMMITTED):                                *)
(*   Read : SELECT id, qty_available ... FOR UPDATE.  If the row exists    *)
(*          this waits for and takes the row lock and reads the latest     *)
(*          committed balance. If the row does NOT exist it locks nothing  *)
(*          and the balance is COALESCE(NULL, 0) = 0.                      *)
(*   Write: new := previous + p_quantity; INSERT ... ON CONFLICT DO UPDATE *)
(*          SET qty_available = EXCLUDED.qty_available (the value computed *)
(*          in Read), insert the ledger row, commit, release the lock.     *)
(*          A conflicting insert waits for the other transaction first.    *)
(*                                                                         *)
(* PROPERTY                                                                *)
(*   BalanceIsSumOfMovements - when nothing is in flight, the balance      *)
(*                             equals the start + every committed movement.*)
(*   NeverNegative           - the balance never goes below 0 (no route    *)
(*                             here passes p_allow_negative).              *)
(***************************************************************************)
EXTENDS Integers

CONSTANTS Reqs, Deltas, RowExistsAtStart, Start0,
          Fixed    \* TRUE = create the row first (INSERT ... ON CONFLICT DO NOTHING), then lock it

VARIABLES rowExists, qty, holder, ledger, pc, arg, seen

vars == <<rowExists, qty, holder, ledger, pc, arg, seen>>

None == "none"

Begin(q) ==
  /\ pc[q] = "idle"
  /\ \E d \in Deltas : pc' = [pc EXCEPT ![q] = "read"] /\ arg' = [arg EXCEPT ![q] = d]
  /\ UNCHANGED <<rowExists, qty, holder, ledger, seen>>

Read(q) ==
  /\ pc[q] = "read"
  /\ IF rowExists \/ Fixed
     THEN /\ holder = None                               \* FOR UPDATE waits for the lock
          /\ holder' = q
          /\ seen' = [seen EXCEPT ![q] = IF rowExists THEN qty ELSE 0]
          /\ rowExists' = TRUE                          \* Fixed: the row now exists
          /\ qty' = IF rowExists THEN qty ELSE 0
     ELSE /\ seen' = [seen EXCEPT ![q] = 0]              \* no row: nothing to lock
          /\ UNCHANGED <<holder, rowExists, qty>>
  /\ pc' = [pc EXCEPT ![q] = "write"]
  /\ UNCHANGED <<arg, ledger>>

Write(q) ==
  /\ pc[q] = "write"
  /\ holder \in {None, q}                                \* ON CONFLICT DO UPDATE waits for the row lock
  /\ LET new == seen[q] + arg[q] IN
     IF new < 0
     THEN /\ UNCHANGED <<qty, ledger, rowExists>>       \* RAISE EXCEPTION 'Insufficient stock' -> rollback
     ELSE /\ qty' = new                                  \* EXCLUDED.qty_available
          /\ rowExists' = TRUE
          /\ ledger' = ledger + arg[q]
  /\ holder' = IF holder = q THEN None ELSE holder
  /\ pc' = [pc EXCEPT ![q] = "done"]
  /\ UNCHANGED <<arg, seen>>

Init ==
  /\ rowExists = RowExistsAtStart /\ qty = IF RowExistsAtStart THEN Start0 ELSE 0
  /\ holder = None /\ ledger = 0
  /\ pc = [q \in Reqs |-> "idle"] /\ arg = [q \in Reqs |-> 0] /\ seen = [q \in Reqs |-> 0]

Next ==
  \/ \E q \in Reqs : Begin(q) \/ Read(q) \/ Write(q)
  \/ (\A q \in Reqs : pc[q] = "done") /\ UNCHANGED vars

Spec == Init /\ [][Next]_vars

Idle == \A q \in Reqs : pc[q] \in {"idle", "done"}

BalanceIsSumOfMovements == Idle => qty = (IF RowExistsAtStart THEN Start0 ELSE 0) + ledger
NeverNegative           == qty >= 0
=============================================================================
