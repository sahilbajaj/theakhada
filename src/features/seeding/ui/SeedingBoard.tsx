import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SeedingRow } from "@/features/seeding/ui/SeedingRow";
import type { RosterMember } from "@/hooks/useClubRoster";

interface Props {
  order: string[];
  onOrderChange: (next: string[]) => void;
  membersById: Map<string, RosterMember>;
  suggestedSeedById: Map<string, number>;
  preferNicknames: boolean;
  editable: boolean;
}

export function SeedingBoard({ order, onOrderChange, membersById, suggestedSeedById, preferNicknames, editable }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onOrderChange(arrayMove(order, from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="grid gap-2">
          {order.map((id, index) => {
            const member = membersById.get(id);
            if (!member) return null;
            return (
              <SeedingRow
                key={id}
                member={member}
                currentSeed={index + 1}
                suggestedSeed={suggestedSeedById.get(id)}
                preferNicknames={preferNicknames}
                editable={editable}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
