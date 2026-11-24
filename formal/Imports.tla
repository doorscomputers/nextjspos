------------------------------- MODULE Imports -------------------------------
(***************************************************************************)
(* Stock SET from outside: physical-count upload and opening stock, for    *)
(* ONE product at ONE branch, next to ordinary stock movements.            *)
(*   Upload  src/app/api/admin/physical-inventory-upload/route.ts POST     *)
(*           (Admin > Physical Inventory Upload screen). Reads stock       *)
(*           OUTSIDE the transaction (findMany 291, currentStock 380),     *)
(*           difference = count - that read (411), then the transaction    *)
(*           (488) creates an approved correction and calls updateStock    *)
(*           with quantity = difference (539-544).                         *)
(*   Opening src/app/api/products/[id]/opening-stock/route.ts POST.        *)
(*           Pre-checks outside: "no stock_transactions yet" (145-159).    *)
(*           Transaction (165): upsert qtyAvailable = quantity (absolute)  *)
(*           + one 'opening_stock' stock_transactions row.                 *)
(*   Move    any other route that posts through update_inventory_with_     *)
(*           history (sale -1, receive +1): ledger row + balance change.   *)
(*                                                                         *)
(* PROPERTIES                                                              *)
(*   LedgerMatchesBalance - the sum of stock_transactions rows equals the  *)
(*                          stock balance (no lost or phantom movement).   *)
(*   UploadSetsCount      - after an upload, stock equals the uploaded     *)
(*                          count (when nothing else ran after it).        *)
(***************************************************************************)
EXTENDS Integers

CONSTANTS Reqs, Kinds, Counts,
          OneAtATime, Fixed

VARIABLES stock,     \* variation_location_details.qty_available
          ledger,    \* SUM(stock_transactions.quantity)
          rows,      \* number of stock_transactions rows
          last,      \* <<kind, count>> of the last request that changed stock
          pc, arg, snap

vars == <<stock, ledger, rows, last, pc, arg, snap>>

Moves == {1, -1}   \* a sale of one unit, a receipt of one unit

PreOK(r, n) ==
  CASE r = "Upload"  -> n # stock               \* route.ts:383 skips rows already equal
    [] r = "Opening" -> rows = 0                \* opening-stock/route.ts:145-159
    [] r = "Move"    -> stock + n >= 0          \* stockOperations.ts:567 early check

Start(q) ==
  /\ pc[q] = "idle"
  /\ OneAtATime => \A p \in Reqs : pc[p] \in {"idle", "done"}
  /\ \E r \in Kinds : \E n \in (IF r = "Move" THEN Moves ELSE Counts) :
       IF PreOK(r, n)
       THEN pc' = [pc EXCEPT ![q] = r] /\ arg' = [arg EXCEPT ![q] = n]
            /\ snap' = [snap EXCEPT ![q] = stock]
       ELSE pc' = [pc EXCEPT ![q] = "done"] /\ UNCHANGED <<arg, snap>>
  /\ UNCHANGED <<stock, ledger, rows, last>>

Done(q) == pc' = [pc EXCEPT ![q] = "done"] /\ UNCHANGED <<arg, snap>>

\* The stock function adds p_quantity to the LATEST locked balance and writes one ledger row.
Post(d) == stock' = stock + d /\ ledger' = ledger + d /\ rows' = rows + 1

\* physical-inventory-upload/route.ts:488-544. quantity = count - stock read before the transaction.
\* Fixed: the difference is computed from the locked balance inside the transaction.
CommitUpload(q) ==
  /\ pc[q] = "Upload"
  /\ LET d == arg[q] - (IF Fixed THEN stock ELSE snap[q]) IN
       IF d # 0 THEN Post(d) /\ last' = <<"Upload", arg[q]>> ELSE UNCHANGED <<stock, ledger, rows, last>>
  /\ Done(q)

\* opening-stock/route.ts:165-205: upsert qtyAvailable = n (absolute) + ledger row of n.
\* Fixed: re-check "no ledger rows" inside the transaction under the row lock.
CommitOpening(q) ==
  /\ pc[q] = "Opening"
  /\ IF ~Fixed \/ rows = 0
     THEN stock' = arg[q] /\ ledger' = ledger + arg[q] /\ rows' = rows + 1
          /\ last' = <<"Opening", arg[q]>>
     ELSE UNCHANGED <<stock, ledger, rows, last>>
  /\ Done(q)

\* update_inventory_with_history: raises if the new balance would be negative.
CommitMove(q) ==
  /\ pc[q] = "Move"
  /\ IF stock + arg[q] >= 0 THEN Post(arg[q]) /\ last' = <<"Move", 0>>
     ELSE UNCHANGED <<stock, ledger, rows, last>>
  /\ Done(q)

Init ==
  /\ stock = 0 /\ ledger = 0 /\ rows = 0 /\ last = <<"None", 0>>
  /\ pc = [q \in Reqs |-> "idle"] /\ arg = [q \in Reqs |-> 0] /\ snap = [q \in Reqs |-> 0]

Next ==
  \/ \E q \in Reqs : Start(q) \/ CommitUpload(q) \/ CommitOpening(q) \/ CommitMove(q)
  \/ (\A q \in Reqs : pc[q] = "done") /\ UNCHANGED vars

Spec == Init /\ [][Next]_vars

Idle == \A q \in Reqs : pc[q] \in {"idle", "done"}

LedgerMatchesBalance == ledger = stock
UploadSetsCount      == (Idle /\ last[1] = "Upload") => stock = last[2]
=============================================================================
