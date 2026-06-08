import { useCallback, useMemo, useState } from 'react';
import {
  MessageSquare,
  GitBranch,
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  CornerDownRight,
  AlertTriangle,
  Zap,
  Lock,
  Filter,
  X,
  Layers,
} from 'lucide-react';
import {
  useGraphStore,
  type SceneNodeData,
  type DialogueBlock,
  type TextBlock,
  type ChoiceBlock,
  type ChoiceOption,
  type LogicBlock,
  type LogicOperation,
  type ChoiceCondition,
  type VariableDefinition,
  type CharacterSlot,
  type CharacterPosition,
  type CharacterAnimation,
} from '../../stores/graphStore';
import { useActiveGraph } from '../../hooks/useActiveGraph';
import { useAssetStore } from '../../stores/assetStore';
import { useDebouncedHistory } from '../../utils/undoHistory';
import AssetPicker from './AssetPicker';

// ────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────

interface OptionConnectionStatus {
  connected: boolean;
  targetLabel?: string;
}

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface DialogueEditorProps {
  nodeId: string;
}

// ────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────

export default function DialogueEditor({ nodeId }: DialogueEditorProps) {
  const { nodes, edges } = useActiveGraph();
  const variables = useGraphStore((s) => s.variables);
  const updateDialogueBlocks = useGraphStore((s) => s.updateDialogueBlocks);
  const assets = useAssetStore((s) => s.assets);

  const node = nodes.find((n) => n.id === nodeId);
  const nodeData = node?.data as SceneNodeData | undefined;
  const blocks: DialogueBlock[] = nodeData?.dialogueBlocks ?? [];

  // Resolve background image URL from asset ID
  const backgroundImageUrl = useMemo(() => {
    const bgId = nodeData?.backgroundImageId;
    if (!bgId) return null;
    const asset = assets.find((a) => a.id === bgId);
    return asset?.file_url ?? null;
  }, [nodeData?.backgroundImageId, assets]);

  // ── Connection status: for each choice option, is it connected to an edge? ──
  const connectionStatusMap = useMemo(() => {
    const map = new Map<string, OptionConnectionStatus>();
    for (const block of blocks) {
      if (block.type !== 'choice') continue;
      for (const opt of block.options) {
        const edge = edges.find(
          (e) => e.source === nodeId && e.sourceHandle === opt.id
        );
        if (edge) {
          const targetNode = nodes.find((n) => n.id === edge.target);
          const targetLabel = (targetNode?.data as SceneNodeData | undefined)?.label;
          map.set(opt.id, { connected: true, targetLabel });
        } else {
          map.set(opt.id, { connected: false });
        }
      }
    }
    return map;
  }, [blocks, edges, nodeId, nodes]);

  // ── Block mutations (all go through updateDialogueBlocks for edge cleanup) ──

  const setBlocks = useCallback(
    (next: DialogueBlock[]) => {
      updateDialogueBlocks(nodeId, next);
    },
    [nodeId, updateDialogueBlocks]
  );

  const addTextBlock = useCallback(
    (insertAt?: number) => {
      const newBlock: TextBlock = {
        id: crypto.randomUUID(),
        type: 'text',
        character: '',
        dialogue: '',
      };
      const next = [...blocks];
      next.splice(insertAt ?? next.length, 0, newBlock);
      setBlocks(next);
    },
    [blocks, setBlocks]
  );

  const addChoiceBlock = useCallback(
    (insertAt?: number) => {
      const newBlock: ChoiceBlock = {
        id: crypto.randomUUID(),
        type: 'choice',
        options: [
          { id: crypto.randomUUID(), label: 'Option A' },
          { id: crypto.randomUUID(), label: 'Option B' },
        ],
      };
      const next = [...blocks];
      next.splice(insertAt ?? next.length, 0, newBlock);
      setBlocks(next);
    },
    [blocks, setBlocks]
  );

  const addLogicBlock = useCallback(
    (insertAt?: number) => {
      const newBlock: LogicBlock = {
        id: crypto.randomUUID(),
        type: 'logic',
        operations: [],
      };
      const next = [...blocks];
      next.splice(insertAt ?? next.length, 0, newBlock);
      setBlocks(next);
    },
    [blocks, setBlocks]
  );

  const removeBlock = useCallback(
    (blockId: string) => {
      setBlocks(blocks.filter((b) => b.id !== blockId));
    },
    [blocks, setBlocks]
  );

  const debouncedHistory = useDebouncedHistory();

  const updateBlock = useCallback(
    (blockId: string, patch: Partial<TextBlock> | Partial<ChoiceBlock> | Partial<LogicBlock>) => {
      debouncedHistory();
      setBlocks(
        blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) as DialogueBlock[]
      );
    },
    [blocks, setBlocks, debouncedHistory]
  );

  const moveBlock = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= blocks.length) return;
      const next = [...blocks];
      [next[index], next[target]] = [next[target], next[index]];
      setBlocks(next);
    },
    [blocks, setBlocks]
  );

  // ── Choice option helpers ──

  const addOption = useCallback(
    (blockId: string) => {
      setBlocks(
        blocks.map((b) => {
          if (b.id !== blockId || b.type !== 'choice') return b;
          return {
            ...b,
            options: [
              ...b.options,
              { id: crypto.randomUUID(), label: `Option ${b.options.length + 1}` },
            ],
          };
        })
      );
    },
    [blocks, setBlocks]
  );

  const removeOption = useCallback(
    (blockId: string, optionId: string) => {
      setBlocks(
        blocks.map((b) => {
          if (b.id !== blockId || b.type !== 'choice') return b;
          return { ...b, options: b.options.filter((o) => o.id !== optionId) };
        })
      );
    },
    [blocks, setBlocks]
  );

  const updateOption = useCallback(
    (blockId: string, optionId: string, patch: Partial<ChoiceOption>) => {
      debouncedHistory();
      setBlocks(
        blocks.map((b) => {
          if (b.id !== blockId || b.type !== 'choice') return b;
          return {
            ...b,
            options: b.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
          };
        })
      );
    },
    [blocks, setBlocks, debouncedHistory]
  );

  const moveOption = useCallback(
    (blockId: string, index: number, direction: -1 | 1) => {
      setBlocks(
        blocks.map((b) => {
          if (b.id !== blockId || b.type !== 'choice') return b;
          const target = index + direction;
          if (target < 0 || target >= b.options.length) return b;
          const opts = [...b.options];
          [opts[index], opts[target]] = [opts[target], opts[index]];
          return { ...b, options: opts };
        })
      );
    },
    [blocks, setBlocks]
  );

  // ── Render ──

  if (!node) {
    return (
      <div className="flex h-full items-center justify-center text-gray-600 dark:text-gray-500">
        Node not found.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-100 dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
          Dialogue Script
        </span>
        <span className="text-xs text-gray-600 dark:text-gray-500 dark:text-gray-600">—</span>
        <span className="text-sm text-blue-400 font-medium">{nodeData?.label}</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => addTextBlock()}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-300 dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors cursor-pointer"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Add Text
          </button>
          <button
            onClick={() => addChoiceBlock()}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors cursor-pointer"
          >
            <GitBranch className="h-3.5 w-3.5" />
            Add Choice
          </button>
          <button
            onClick={() => addLogicBlock()}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 transition-colors cursor-pointer"
          >
            <Zap className="h-3.5 w-3.5" />
            Add Logic
          </button>
        </div>
      </div>

      {/* Script body */}
      <div className="flex-1 overflow-y-auto px-4 py-6 relative">
        {/* Background image layer */}
        {backgroundImageUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-10 blur-sm pointer-events-none"
            style={{ backgroundImage: `url(${backgroundImageUrl})` }}
          />
        )}
        <div className="relative mx-auto max-w-2xl space-y-3">
          {blocks.length === 0 && (
            <EmptyState onAddText={() => addTextBlock()} onAddChoice={() => addChoiceBlock()} onAddLogic={() => addLogicBlock()} />
          )}

          {blocks.map((block, index) => (
            <div key={block.id}>
              {/* Between-block insert buttons */}
              {index > 0 && <InsertBar onAddText={() => addTextBlock(index)} onAddChoice={() => addChoiceBlock(index)} onAddLogic={() => addLogicBlock(index)} />}

              {block.type === 'text' ? (
                <TextBlockCard
                  block={block}
                  index={index}
                  total={blocks.length}
                  onUpdate={(patch) => updateBlock(block.id, patch)}
                  onRemove={() => removeBlock(block.id)}
                  onMove={(dir) => moveBlock(index, dir)}
                />
              ) : block.type === 'choice' ? (
                <ChoiceBlockCard
                  block={block}
                  index={index}
                  total={blocks.length}
                  isLastBlock={index === blocks.length - 1}
                  connectionStatusMap={connectionStatusMap}
                  variables={variables}
                  onUpdate={(patch) => updateBlock(block.id, patch)}
                  onRemove={() => removeBlock(block.id)}
                  onMove={(dir) => moveBlock(index, dir)}
                  onAddOption={() => addOption(block.id)}
                  onRemoveOption={(optId) => removeOption(block.id, optId)}
                  onUpdateOption={(optId, patch) => updateOption(block.id, optId, patch)}
                  onMoveOption={(optIdx, dir) => moveOption(block.id, optIdx, dir)}
                />
              ) : block.type === 'logic' ? (
                <LogicBlockCard
                  block={block}
                  index={index}
                  total={blocks.length}
                  variables={variables}
                  onUpdate={(patch) => updateBlock(block.id, patch)}
                  onRemove={() => removeBlock(block.id)}
                  onMove={(dir) => moveBlock(index, dir)}
                />
              ) : null}
            </div>
          ))}

          {/* Bottom add buttons */}
          {blocks.length > 0 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={() => addTextBlock()}
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 dark:border-gray-700 px-4 py-2 text-xs text-gray-600 dark:text-gray-500 hover:border-gray-500 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Text
              </button>
              <button
                onClick={() => addChoiceBlock()}
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 dark:border-gray-700 px-4 py-2 text-xs text-gray-600 dark:text-gray-500 hover:border-blue-500 hover:text-blue-400 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Choice
              </button>
              <button
                onClick={() => addLogicBlock()}
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 dark:border-gray-700 px-4 py-2 text-xs text-gray-600 dark:text-gray-500 hover:border-amber-500 hover:text-amber-400 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Logic
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────

function EmptyState({ onAddText, onAddChoice, onAddLogic }: { onAddText: () => void; onAddChoice: () => void; onAddLogic: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 py-16">
      <MessageSquare className="h-10 w-10 text-gray-600 dark:text-gray-500 dark:text-gray-700" />
      <p className="text-sm text-gray-600 dark:text-gray-500">This scene has no dialogue yet.</p>
      <div className="flex items-center gap-3">
        <button
          onClick={onAddText}
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-300 dark:bg-gray-700 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-600 transition-colors cursor-pointer"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Add Text Block
        </button>
        <button
          onClick={onAddChoice}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 transition-colors cursor-pointer"
        >
          <GitBranch className="h-3.5 w-3.5" />
          Add Choice Block
        </button>
        <button
          onClick={onAddLogic}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-500 transition-colors cursor-pointer"
        >
          <Zap className="h-3.5 w-3.5" />
          Add Logic Block
        </button>
      </div>
    </div>
  );
}

function InsertBar({ onAddText, onAddChoice, onAddLogic }: { onAddText: () => void; onAddChoice: () => void; onAddLogic: () => void }) {
  return (
    <div className="group flex items-center justify-center gap-2 py-1 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity">
      <div className="h-px flex-1 bg-gray-300 dark:bg-gray-800 group-hover:bg-gray-400 dark:group-hover:bg-gray-700 transition-colors" />
      <button
        onClick={onAddText}
        title="Insert Text Block"
        className="rounded p-1 text-gray-600 dark:text-gray-500 dark:text-gray-600 hover:bg-gray-300 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-400 transition-colors cursor-pointer"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onAddChoice}
        title="Insert Choice Block"
        className="rounded p-1 text-gray-600 dark:text-gray-500 dark:text-gray-600 hover:bg-gray-300 dark:hover:bg-gray-800 hover:text-blue-400 transition-colors cursor-pointer"
      >
        <GitBranch className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onAddLogic}
        title="Insert Logic Block"
        className="rounded p-1 text-gray-600 dark:text-gray-500 dark:text-gray-600 hover:bg-gray-300 dark:hover:bg-gray-800 hover:text-amber-400 transition-colors cursor-pointer"
      >
        <Zap className="h-3.5 w-3.5" />
      </button>
      <div className="h-px flex-1 bg-gray-300 dark:bg-gray-800 group-hover:bg-gray-400 dark:group-hover:bg-gray-700 transition-colors" />
    </div>
  );
}

// ── Text Block ──

const ALL_POSITIONS: CharacterPosition[] = ['left-1', 'left-2', 'right-1', 'right-2'];

const POSITION_LABELS: Record<CharacterPosition, string> = {
  'left-1': 'Left',
  'left-2': 'Inner Left',
  'right-1': 'Right',
  'right-2': 'Inner Right',
};

const ANIMATION_OPTIONS: { value: CharacterAnimation; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide', label: 'Slide' },
  { value: 'fade-and-slide', label: 'Fade & Slide' },
];

/** Resolve the characters array, migrating legacy spriteId if needed. */
function resolveCharacters(block: TextBlock): CharacterSlot[] {
  if (block.characters && block.characters.length > 0) return block.characters;
  if (block.spriteId) return [{ spriteId: block.spriteId, position: 'left-1' }];
  return [];
}

interface TextBlockCardProps {
  block: TextBlock;
  index: number;
  total: number;
  onUpdate: (patch: Partial<TextBlock>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}

function TextBlockCard({ block, index, total, onUpdate, onRemove, onMove }: TextBlockCardProps) {
  const assets = useAssetStore((s) => s.assets);
  const characters = resolveCharacters(block);

  // Find the first character sprite for the header avatar
  const firstSpriteId = characters.length > 0 ? characters[0].spriteId : null;
  const headerSpriteAsset = firstSpriteId
    ? assets.find((a) => a.id === firstSpriteId) ?? null
    : null;

  const usedPositions = new Set(characters.map((c) => c.position));
  const availablePositions = ALL_POSITIONS.filter((p) => !usedPositions.has(p));

  const updateCharacterSlot = (slotIndex: number, patch: Partial<CharacterSlot>) => {
    const updated = characters.map((c, i) => (i === slotIndex ? { ...c, ...patch } : c));
    onUpdate({ characters: updated, spriteId: null });
  };

  const addCharacterSlot = () => {
    if (characters.length >= 4) return;
    const nextPosition = availablePositions[0] ?? 'left-1';
    const updated = [...characters, { spriteId: null, position: nextPosition }];
    onUpdate({ characters: updated, spriteId: null });
  };

  const removeCharacterSlot = (slotIndex: number) => {
    const updated = characters.filter((_, i) => i !== slotIndex);
    onUpdate({ characters: updated, spriteId: null });
  };

  return (
    <div className="group rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-2 border-b border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50 px-3 py-1.5">
        {/* Sprite avatar in header */}
        {headerSpriteAsset ? (
          <img
            src={headerSpriteAsset.file_url}
            alt={headerSpriteAsset.file_name}
            className="h-5 w-5 rounded-full object-cover ring-1 ring-gray-600"
          />
        ) : (
          <MessageSquare className="h-3.5 w-3.5 text-gray-500" />
        )}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Text
        </span>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onMove(-1)}
            disabled={index === 0}
            title="Move up"
            className="rounded p-1 text-gray-600 dark:text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            title="Move down"
            className="rounded p-1 text-gray-600 dark:text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onRemove}
            title="Remove block"
            className="rounded p-1 text-gray-600 dark:text-gray-500 hover:text-red-400 cursor-pointer transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Card body */}
      <div className="space-y-3 p-3">
        {/* Speaker name */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
            Speaker
          </label>
          <input
            type="text"
            value={block.character}
            onChange={(e) => onUpdate({ character: e.target.value })}
            placeholder="Character name…"
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
          />
        </div>

        {/* On-screen characters */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
            On-Screen Characters
          </label>
          <div className="space-y-2">
            {characters.map((slot, slotIdx) => (
              <div key={slotIdx} className="rounded-md border border-gray-300 dark:border-gray-700/50 bg-gray-100 dark:bg-gray-900/50 px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <select
                    value={slot.position}
                    onChange={(e) => updateCharacterSlot(slotIdx, { position: e.target.value as CharacterPosition })}
                    className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-1 text-[11px] text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value={slot.position}>{POSITION_LABELS[slot.position]}</option>
                    {ALL_POSITIONS.filter((p) => p !== slot.position && !usedPositions.has(p)).map((p) => (
                      <option key={p} value={p}>{POSITION_LABELS[p]}</option>
                    ))}
                  </select>

                  <AssetPicker
                    category="Character"
                    value={slot.spriteId}
                    onChange={(assetId) => updateCharacterSlot(slotIdx, { spriteId: assetId })}
                    compact
                  />

                  <label className="flex items-center gap-1 flex-1 min-w-0">
                    <span className="text-[10px] text-gray-500 dark:text-gray-500 shrink-0">Enter</span>
                    <select
                      value={slot.enterAnimation ?? 'none'}
                      onChange={(e) => updateCharacterSlot(slotIdx, { enterAnimation: e.target.value as CharacterAnimation })}
                      className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1 py-0.5 text-[10px] text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {ANIMATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1 flex-1 min-w-0">
                    <span className="text-[10px] text-gray-500 dark:text-gray-500 shrink-0">Exit</span>
                    <select
                      value={slot.exitAnimation ?? 'none'}
                      onChange={(e) => updateCharacterSlot(slotIdx, { exitAnimation: e.target.value as CharacterAnimation })}
                      className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1 py-0.5 text-[10px] text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {ANIMATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </label>

                  <button
                    onClick={() => removeCharacterSlot(slotIdx)}
                    title="Remove character"
                    className="rounded p-1 text-gray-500 dark:text-gray-600 hover:text-red-400 cursor-pointer transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}

            {characters.length < 4 && (
              <button
                onClick={addCharacterSlot}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 dark:border-gray-700 py-1.5 text-xs text-gray-600 dark:text-gray-500 hover:border-blue-500 hover:text-blue-400 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Character
              </button>
            )}
          </div>
        </div>

        {/* Dialogue text */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
            Dialogue
          </label>
          <textarea
            value={block.dialogue}
            onChange={(e) => onUpdate({ dialogue: e.target.value })}
            placeholder="Write the dialogue…"
            rows={3}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 outline-none resize-y focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
          />
        </div>
      </div>
    </div>
  );
}

// ── Choice Block ──

interface ChoiceBlockCardProps {
  block: ChoiceBlock;
  index: number;
  total: number;
  isLastBlock: boolean;
  connectionStatusMap: Map<string, OptionConnectionStatus>;
  variables: VariableDefinition[];
  onUpdate: (patch: Partial<ChoiceBlock>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  onAddOption: () => void;
  onRemoveOption: (optionId: string) => void;
  onUpdateOption: (optionId: string, patch: Partial<ChoiceOption>) => void;
  onMoveOption: (optionIndex: number, direction: -1 | 1) => void;
}

function ChoiceBlockCard({
  block,
  index,
  total,
  isLastBlock,
  connectionStatusMap,
  variables,
  onUpdate,
  onRemove,
  onMove,
  onAddOption,
  onRemoveOption,
  onUpdateOption,
  onMoveOption,
}: ChoiceBlockCardProps) {
  const hasUnconnected = block.options.some(
    (opt) => !connectionStatusMap.get(opt.id)?.connected
  );

  return (
    <>
      <div className="group rounded-lg border border-blue-500/40 bg-gray-200 dark:bg-gray-800 overflow-hidden">
        {/* Card header */}
        <div className="flex items-center gap-2 border-b border-blue-500/30 bg-blue-500/5 px-3 py-1.5">
          <GitBranch className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
            Player Choice
          </span>
          <button
            onClick={() => onUpdate({ showOverDialogue: !block.showOverDialogue })}
            title={block.showOverDialogue ? 'Choices overlay preceding dialogue (click to disable)' : 'Show choices over preceding dialogue'}
            className={`ml-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium cursor-pointer transition-colors ${
              block.showOverDialogue
                ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                : 'bg-transparent text-gray-500 hover:text-blue-400'
            }`}
          >
            <Layers className="h-3 w-3" />
            Show over dialogue
          </button>
          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onMove(-1)}
              disabled={index === 0}
              title="Move up"
              className="rounded p-1 text-gray-600 dark:text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onMove(1)}
              disabled={index === total - 1}
              title="Move down"
              className="rounded p-1 text-gray-600 dark:text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onRemove}
              title="Remove block"
              className="rounded p-1 text-gray-600 dark:text-gray-500 hover:text-red-400 cursor-pointer transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Options list */}
        <div className="p-3 space-y-2">
          {block.options.map((opt, optIdx) => (
            <ChoiceOptionRow
              key={opt.id}
              option={opt}
              index={optIdx}
              total={block.options.length}
              status={connectionStatusMap.get(opt.id) ?? { connected: false }}
              isLastBlock={isLastBlock}
              variables={variables}
              onUpdate={(patch) => onUpdateOption(opt.id, patch)}
              onRemove={() => onRemoveOption(opt.id)}
              onMove={(dir) => onMoveOption(optIdx, dir)}
            />
          ))}

          <button
            onClick={onAddOption}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 dark:border-gray-700 py-1.5 text-xs text-gray-600 dark:text-gray-500 hover:border-blue-500 hover:text-blue-400 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Option
          </button>
        </div>
      </div>

      {/* Fallthrough annotation */}
      {hasUnconnected && !isLastBlock && (
        <div className="flex items-center gap-2 px-3 py-1.5 mt-1">
          <CornerDownRight className="h-3.5 w-3.5 text-gray-600" />
          <span className="text-[11px] text-gray-500 dark:text-gray-600 italic">
            Unconnected options continue here
          </span>
        </div>
      )}
    </>
  );
}

// ── Single Choice Option Row ──

interface ChoiceOptionRowProps {
  option: ChoiceOption;
  index: number;
  total: number;
  status: OptionConnectionStatus;
  isLastBlock: boolean;
  variables: VariableDefinition[];
  onUpdate: (patch: Partial<ChoiceOption>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}

function ChoiceOptionRow({ option, index, total, status, isLastBlock, variables, onUpdate, onRemove, onMove }: ChoiceOptionRowProps) {
  const [showCondition, setShowCondition] = useState(!!option.condition);
  const hasCondition = !!option.condition;

  const handleSetCondition = (condition: ChoiceCondition | undefined) => {
    onUpdate({ condition });
  };

  const conditionVariable = option.condition
    ? variables.find((v) => v.id === option.condition!.variableId)
    : null;

  return (
    <div className={`rounded-md transition-colors ${hasCondition ? 'border-l-2 border-l-amber-500/60' : ''}`}>
      <div className="flex items-center gap-2">
        {/* Reorder buttons */}
        <div className="flex flex-col">
          <button
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="text-gray-600 hover:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="text-gray-600 hover:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>

        {/* Grip indicator */}
        <GripVertical className="h-4 w-4 shrink-0 text-gray-600" />

        {/* Condition indicator */}
        {hasCondition && (
          <span title="Has condition">
            <Lock className="h-3 w-3 shrink-0 text-amber-400" />
          </span>
        )}

        {/* Label input */}
        <input
          type="text"
          value={option.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Option label…"
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
        />

        {/* Condition toggle */}
        <button
          onClick={() => {
            if (showCondition) {
              handleSetCondition(undefined);
              setShowCondition(false);
            } else {
              setShowCondition(true);
            }
          }}
          title={showCondition ? 'Remove condition' : 'Add condition'}
          className={`rounded p-1 cursor-pointer transition-colors ${
            showCondition
              ? 'text-amber-400 hover:text-amber-300'
              : 'text-gray-600 hover:text-amber-400'
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
        </button>

        {/* Connection status badge */}
        {status.connected ? (
          <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400" title={`Connected to ${status.targetLabel ?? 'node'}`}>
            <ArrowRight className="h-3 w-3" />
            {status.targetLabel ?? 'Node'}
          </span>
        ) : isLastBlock ? (
          <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400" title="No connection and no blocks below — dead end">
            <AlertTriangle className="h-3 w-3" />
            dead end
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-gray-700/50 px-2 py-0.5 text-[10px] font-medium text-gray-500" title="Falls through to next block below">
            <CornerDownRight className="h-3 w-3" />
            falls through
          </span>
        )}

        {/* Delete */}
        <button
          onClick={onRemove}
          disabled={total <= 1}
          title="Remove option"
          className="rounded p-1 text-gray-500 dark:text-gray-600 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Condition row */}
      {showCondition && (
        <div className="ml-12 mt-1.5 flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1.5">
          <span className="text-[10px] font-semibold text-amber-400/70 shrink-0">IF</span>

          {/* Variable dropdown */}
          <select
            value={option.condition?.variableId ?? ''}
            onChange={(e) => {
              const varDef = variables.find((v) => v.id === e.target.value);
              handleSetCondition({
                variableId: e.target.value,
                comparison: option.condition?.comparison ?? '==',
                value: varDef ? varDef.initialValue : '',
              });
            }}
            className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-0.5 text-[11px] text-gray-700 dark:text-gray-300 outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="">Select variable...</option>
            {variables.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>

          {/* Comparison dropdown */}
          <select
            value={option.condition?.comparison ?? '=='}
            onChange={(e) => {
              if (!option.condition) return;
              handleSetCondition({
                ...option.condition,
                comparison: e.target.value as ChoiceCondition['comparison'],
              });
            }}
            className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-0.5 text-[11px] text-gray-700 dark:text-gray-300 outline-none focus:border-amber-500 cursor-pointer font-mono"
          >
            <option value="==">==</option>
            <option value="!=">!=</option>
            {conditionVariable?.type === 'number' && (
              <>
                <option value="&gt;">&gt;</option>
                <option value="<">&lt;</option>
                <option value="&gt;=">&gt;=</option>
              </>
            )}
          </select>

          {/* Value input */}
          {conditionVariable?.type === 'boolean' ? (
            <select
              value={String(option.condition?.value ?? 'false')}
              onChange={(e) => {
                if (!option.condition) return;
                handleSetCondition({ ...option.condition, value: e.target.value === 'true' });
              }}
              className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-0.5 text-[11px] text-gray-700 dark:text-gray-300 outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              type={conditionVariable?.type === 'number' ? 'number' : 'text'}
              value={String(option.condition?.value ?? '')}
              onChange={(e) => {
                if (!option.condition) return;
                const val = conditionVariable?.type === 'number' ? Number(e.target.value) || 0 : e.target.value;
                handleSetCondition({ ...option.condition, value: val });
              }}
              placeholder="value"
              className="w-16 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-0.5 text-[11px] text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-amber-500 transition-colors"
            />
          )}

          {/* Remove condition */}
          <button
            onClick={() => {
              handleSetCondition(undefined);
              setShowCondition(false);
            }}
            title="Remove condition"
            className="rounded p-0.5 text-gray-500 dark:text-gray-600 hover:text-red-400 cursor-pointer transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Logic Block ──

interface LogicBlockCardProps {
  block: LogicBlock;
  index: number;
  total: number;
  variables: VariableDefinition[];
  onUpdate: (patch: Partial<LogicBlock>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}

function LogicBlockCard({ block, index, total, variables, onUpdate, onRemove, onMove }: LogicBlockCardProps) {
  const addOperation = () => {
    const newOp: LogicOperation = {
      variableId: variables[0]?.id ?? '',
      operator: '=',
      value: 0,
    };
    onUpdate({ operations: [...block.operations, newOp] });
  };

  const updateOperation = (opIndex: number, patch: Partial<LogicOperation>) => {
    const updated = block.operations.map((op, i) =>
      i === opIndex ? { ...op, ...patch } : op
    );
    onUpdate({ operations: updated });
  };

  const removeOperation = (opIndex: number) => {
    onUpdate({ operations: block.operations.filter((_, i) => i !== opIndex) });
  };

  return (
    <div className="group rounded-lg border border-amber-500/40 bg-gray-200 dark:bg-gray-800 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/5 px-3 py-1.5">
        <Zap className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
          Set Variable
        </span>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onMove(-1)}
            disabled={index === 0}
            title="Move up"
            className="rounded p-1 text-gray-600 dark:text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            title="Move down"
            className="rounded p-1 text-gray-600 dark:text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onRemove}
            title="Remove block"
            className="rounded p-1 text-gray-600 dark:text-gray-500 hover:text-red-400 cursor-pointer transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Operations */}
      <div className="p-3 space-y-2">
        {block.operations.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-600 italic text-center py-2">No operations yet.</p>
        )}

        {block.operations.map((op, opIdx) => {
          const varDef = variables.find((v) => v.id === op.variableId);
          const isNumber = varDef?.type === 'number';

          return (
            <div key={opIdx} className="flex items-center gap-2">
              {/* Variable dropdown */}
              <select
                value={op.variableId}
                onChange={(e) => {
                  const newVar = variables.find((v) => v.id === e.target.value);
                  updateOperation(opIdx, {
                    variableId: e.target.value,
                    operator: '=',
                    value: newVar ? newVar.initialValue : '',
                  });
                }}
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-amber-500 cursor-pointer font-mono"
              >
                <option value="">Select variable...</option>
                {variables.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>

              {/* Operator dropdown */}
              <select
                value={op.operator}
                onChange={(e) => updateOperation(opIdx, { operator: e.target.value as LogicOperation['operator'] })}
                className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-amber-500 cursor-pointer font-mono w-14 text-center"
              >
                <option value="=">=</option>
                {isNumber && <option value="+=">+=</option>}
                {isNumber && <option value="-=">-=</option>}
              </select>

              {/* Value input */}
              {varDef?.type === 'boolean' ? (
                <select
                  value={String(op.value)}
                  onChange={(e) => updateOperation(opIdx, { value: e.target.value === 'true' })}
                  className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  type={isNumber ? 'number' : 'text'}
                  value={String(op.value)}
                  onChange={(e) => {
                    const val = isNumber ? Number(e.target.value) || 0 : e.target.value;
                    updateOperation(opIdx, { value: val });
                  }}
                  placeholder="value"
                  className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-amber-500 transition-colors"
                />
              )}

              {/* Remove operation */}
              <button
                onClick={() => removeOperation(opIdx)}
                title="Remove operation"
                className="rounded p-1 text-gray-500 dark:text-gray-600 hover:text-red-400 cursor-pointer transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

        <button
          onClick={addOperation}
          disabled={variables.length === 0}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 dark:border-gray-700 py-1.5 text-xs text-gray-600 dark:text-gray-500 hover:border-amber-500 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Operation
        </button>
      </div>
    </div>
  );
}
