# Turn Flow

## Owner-decided flexible turn system

The POS suggests workers, but owner chooses.

## Suggested worker algorithm

Filter out:

- Off today.
- On break.
- In service.

Rank available workers by:

1. Lowest turns taken today.
2. Oldest last completed turn time.
3. Lowest service sales today.
4. Lower current workload.

## Assignment flow

1. Customer appears in waiting queue.
2. Owner clicks `Assign worker`.
3. POS displays suggested worker ranking.
4. Owner chooses worker.
5. Turn row is created with status `assigned`.
6. Check-in status becomes `assigned`.

## Start service

1. Owner or worker clicks `Start service`.
2. Turn status becomes `in_service`.
3. `started_at` is set.
4. Worker status becomes `in_service`.
5. Turn count for today includes this turn.

Turn count must not increase before `started_at` exists.

## Complete service

1. Owner or worker clicks `Complete service`.
2. Turn status becomes `completed`.
3. `ended_at` and `completed_at` are set.
4. Worker status becomes `available`.
5. Check-in status becomes `ready_for_checkout`.

## Skip turn

1. Owner chooses skip reason.
2. Turn status becomes `skipped`.
3. `skipped_at` is set.
4. Worker remains or becomes available depending on reason.

## Dashboard fields

Owner turn dashboard should show:

- Worker name.
- Worker status.
- Turns taken today.
- Active customer.
- Active service.
- Service start time.
- Estimated duration.
- Last turn time.
- Sales today.
- Tips today.
- Suggested rank.
