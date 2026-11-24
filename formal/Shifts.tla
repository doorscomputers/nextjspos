-------------------------------- MODULE Shifts --------------------------------
(***************************************************************************)
(* Cashier shifts for ONE cashier at ONE branch.                           *)
(*   Open   src/app/api/shifts/route.ts POST: findFirst open shift for the *)
(*          user (199-206), then cashierShift.create (264). No transaction,*)
(*          no unique "one open shift per user" index.                     *)
(*   Close  src/app/api/shifts/[id]/close/route.ts POST: findUnique (165), *)
(*          refuse if closed (184); systemCash / totals from that read     *)
(*          (208-240); X/Z readings outside the transaction (readings-     *)
(*          instant.ts, the reading log insert is in try/catch);           *)
(*          transaction 317: businessLocation zCounter +1, accumulatedSales*)
(*          + totals (321-326), cashierShift.update where { id } status    *)
(*          'closed' (330-343). No status in the WHERE.                    *)
(*          shifts/[id]/force-close (132 -> 183) and shifts/force-close    *)
(*          (45 -> 57) follow the same check-then-update-by-id pattern.    *)
(*   Money  anything that adds to the shift's running totals: sale         *)
(*          (sales/route.ts: open shift read 757-803 outside, transaction  *)
(*          1081, incrementShiftTotalsForSale 1393 -> update where { id }, *)
(*          shift-running-totals.ts:83), AR payment (sales/[id]/payment    *)
(*          shiftId from the body, shift-running-totals.ts:543), cash in / *)
(*          out (cash/in, cash/out, cash/in-out), refund, void.            *)
(*                                                                         *)
(* PROPERTIES                                                              *)
(*   OneOpenShift   - the cashier never has two open shifts.               *)
(*   ZOncePerShift  - the branch Z counter rises once per closed shift.    *)
(*   ZMatchesShift  - a closed shift's Z / system cash equals the money    *)
(*                    recorded in that shift (nothing lands after or is    *)
(*                    left out of the Z reading).                          *)
(*   AccumulatedOk  - the branch accumulated sales equals the sum of the   *)
(*                    closed shifts' Z totals.                             *)
(***************************************************************************)
EXTENDS Integers, FiniteSets

CONSTANTS Reqs, Slots, OneAtATime, Fixed

VARIABLES st,        \* per slot: "none" | "open" | "closed"
          running,   \* per slot: running totals (money recorded in the shift)
          zTotal,    \* per slot: total written by close (Z reading / systemCash)
          zCounter, accumulated,
          pc, arg, snap

vars == <<st, running, zTotal, zCounter, accumulated, pc, arg, snap>>

OpenSlots == {s \in Slots : st[s] = "open"}
FreeSlots == {s \in Slots : st[s] = "none"}

Start(q) ==
  /\ pc[q] = "idle"
  /\ OneAtATime => \A p \in Reqs : pc[p] \in {"idle", "done"}
  /\ \/ \* Open: shifts/route.ts:199 - refuse if an open shift exists
        /\ FreeSlots # {}
        /\ IF OpenSlots = {} THEN \E s \in FreeSlots : pc' = [pc EXCEPT ![q] = "Open"] /\ arg' = [arg EXCEPT ![q] = s]
           ELSE pc' = [pc EXCEPT ![q] = "done"] /\ UNCHANGED arg
        /\ UNCHANGED snap
     \/ \* Close: close/route.ts:165-184, totals from this read
        \E s \in Slots : /\ st[s] = "open"
                         /\ pc' = [pc EXCEPT ![q] = "Close"] /\ arg' = [arg EXCEPT ![q] = s]
                         /\ snap' = [snap EXCEPT ![q] = running[s]]
     \/ \* Money: sales/route.ts:757-803 reads the open shift; refuse if none
        IF OpenSlots = {} THEN pc' = [pc EXCEPT ![q] = "done"] /\ UNCHANGED <<arg, snap>>
        ELSE \E s \in OpenSlots : pc' = [pc EXCEPT ![q] = "Money"] /\ arg' = [arg EXCEPT ![q] = s] /\ UNCHANGED snap
  /\ UNCHANGED <<st, running, zTotal, zCounter, accumulated>>

Done(q) == pc' = [pc EXCEPT ![q] = "done"] /\ UNCHANGED <<arg, snap>>

\* shifts/route.ts:264 cashierShift.create. Fixed: a partial unique index (user_id) WHERE status='open'.
CommitOpen(q) ==
  /\ pc[q] = "Open"
  /\ LET s == arg[q] IN
       IF st[s] = "none" /\ (~Fixed \/ OpenSlots = {})
       THEN st' = [st EXCEPT ![s] = "open"] ELSE UNCHANGED st
  /\ Done(q)
  /\ UNCHANGED <<running, zTotal, zCounter, accumulated>>

\* close/route.ts:317-343. Fixed: updateMany where { id, status: 'open' } first (else 409),
\* and totals read from the locked row inside the transaction.
CommitClose(q) ==
  /\ pc[q] = "Close"
  /\ LET s == arg[q]
         t == IF Fixed THEN running[s] ELSE snap[q] IN
       IF ~Fixed \/ st[s] = "open"
       THEN /\ st' = [st EXCEPT ![s] = "closed"]
            /\ zTotal' = [zTotal EXCEPT ![s] = t]
            /\ zCounter' = zCounter + 1
            /\ accumulated' = accumulated + t
       ELSE UNCHANGED <<st, zTotal, zCounter, accumulated>>
  /\ Done(q)
  /\ UNCHANGED running

\* incrementShiftTotalsForSale & co: cashierShift.update({ where: { id } }) with { increment }.
\* Fixed: updateMany where { id, status: 'open' }; 0 rows -> the sale/payment rolls back.
CommitMoney(q) ==
  /\ pc[q] = "Money"
  /\ LET s == arg[q] IN
       IF ~Fixed \/ st[s] = "open"
       THEN running' = [running EXCEPT ![s] = @ + 1] ELSE UNCHANGED running
  /\ Done(q)
  /\ UNCHANGED <<st, zTotal, zCounter, accumulated>>

Init ==
  /\ st = [s \in Slots |-> "none"] /\ running = [s \in Slots |-> 0] /\ zTotal = [s \in Slots |-> 0]
  /\ zCounter = 0 /\ accumulated = 0
  /\ pc = [q \in Reqs |-> "idle"] /\ arg = [q \in Reqs |-> CHOOSE s \in Slots : TRUE]
  /\ snap = [q \in Reqs |-> 0]

Next ==
  \/ \E q \in Reqs : Start(q) \/ CommitOpen(q) \/ CommitClose(q) \/ CommitMoney(q)
  \/ (\A q \in Reqs : pc[q] = "done") /\ UNCHANGED vars

Spec == Init /\ [][Next]_vars

Closed == {s \in Slots : st[s] = "closed"}
RECURSIVE SumZ(_)
SumZ(S) == IF S = {} THEN 0 ELSE LET s == CHOOSE x \in S : TRUE IN zTotal[s] + SumZ(S \ {s})

OneOpenShift  == Cardinality(OpenSlots) <= 1
ZOncePerShift == zCounter = Cardinality(Closed)
ZMatchesShift == \A s \in Closed : zTotal[s] = running[s]
AccumulatedOk == accumulated = SumZ(Closed)
=============================================================================
