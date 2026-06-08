import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Save, Download, LogOut, Pencil, Trash2 } from 'lucide-react';
import { useGameStore } from '../../stores/gameStore';
import { saveRepository } from '../../storage';
import type { SaveSlotMeta } from '../../storage';

interface SaveMenuProps {
  gameId: string;
}

const SLOT_COUNT = 3;

const emptySlots = (): SaveSlotMeta[] =>
  Array.from({ length: SLOT_COUNT }, (_, i) => ({
    slotIndex: i + 1,
    createdAt: null,
    slotName: null,
  }));

export default function SaveMenu({ gameId }: SaveMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const cameFromEditor = (location.state as { from?: string } | null)?.from === 'editor';
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<SaveSlotMeta[]>(emptySlots);
  const [slotNames, setSlotNames] = useState<Record<number, string>>(
    () => Object.fromEntries(Array.from({ length: SLOT_COUNT }, (_, i) => [i + 1, ''])),
  );
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    const data = await saveRepository.listSlots(gameId);
    const fresh = data.length > 0 ? data : emptySlots();
    setSlots(fresh);
    setSlotNames((prev) => {
      const next = { ...prev };
      for (const s of fresh) {
        next[s.slotIndex] = s.slotName ?? '';
      }
      return next;
    });
  }, [gameId]);

  useEffect(() => {
    if (open) {
      void fetchSlots();
    }
  }, [open, fetchSlots]);

  const handleSave = async (slotIndex: number) => {
    setBusySlot(slotIndex);
    setFeedback(null);

    const { currentNodeId, variables } = useGameStore.getState();
    if (!currentNodeId) {
      setFeedback('Nothing to save yet.');
      setBusySlot(null);
      return;
    }

    const name = slotNames[slotIndex]?.trim() || null;
    try {
      await saveRepository.upsertSlot(gameId, slotIndex, {
        nodeId: currentNodeId,
        variables,
        slotName: name,
        createdAt: new Date().toISOString(),
      });
      setFeedback(`Saved to Slot ${slotIndex}!`);
      await fetchSlots();
    } catch {
      setFeedback('Save failed. Please try again.');
    }
    setBusySlot(null);
  };

  const handleLoad = async (slotIndex: number) => {
    setBusySlot(slotIndex);
    setFeedback(null);

    const slot = slots.find((s) => s.slotIndex === slotIndex);
    if (!slot?.createdAt || !slot.nodeId) {
      setFeedback('No save data found.');
      setBusySlot(null);
      return;
    }

    useGameStore.setState({
      currentNodeId: slot.nodeId,
      currentBlockIndex: 0,
      variables: slot.variables ?? {},
      isEnded: false,
      history: [],
      toastMessage: null,
    });

    setFeedback(`Loaded Slot ${slotIndex}!`);
    setBusySlot(null);
    setOpen(false);
  };

  const handleRename = async (slotIndex: number) => {
    const slot = slots.find((s) => s.slotIndex === slotIndex);
    if (!slot?.createdAt || !slot.nodeId) return;

    const name = slotNames[slotIndex]?.trim() || null;
    if (name === (slot.slotName ?? '')) return;

    setBusySlot(slotIndex);
    setFeedback(null);

    try {
      await saveRepository.upsertSlot(gameId, slotIndex, {
        nodeId: slot.nodeId,
        variables: slot.variables ?? {},
        slotName: name,
        createdAt: slot.createdAt,
      });
      setFeedback(`Renamed Slot ${slotIndex}.`);
      await fetchSlots();
    } catch {
      setFeedback('Rename failed. Please try again.');
    }
    setBusySlot(null);
  };

  const handleDelete = async (slotIndex: number) => {
    const slot = slots.find((s) => s.slotIndex === slotIndex);
    if (!slot?.createdAt) return;

    setBusySlot(slotIndex);
    setFeedback(null);

    try {
      await saveRepository.deleteSlot(gameId, slotIndex);
      setFeedback(`Deleted Slot ${slotIndex}.`);
      await fetchSlots();
    } catch {
      setFeedback('Delete failed. Please try again.');
    }
    setBusySlot(null);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-gray-300 hover:text-white hover:bg-black/80 transition-colors cursor-pointer"
        title="Menu"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed top-0 right-0 z-50 h-full w-80 max-w-[90vw] bg-gray-900/95 backdrop-blur-lg border-l border-white/10 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-300">
              Game Menu
            </h2>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-gray-500 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
              Save Slots
            </p>
            <div className="space-y-3">
              {slots.map((slot) => (
                <div
                  key={slot.slotIndex}
                  className="rounded-lg border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-200">
                      Slot {slot.slotIndex}
                    </span>
                    <span className="text-xs text-gray-500">
                      {slot.createdAt ? formatTime(slot.createdAt) : 'Empty'}
                    </span>
                  </div>
                  <div className="relative mb-2">
                    <Pencil className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={slotNames[slot.slotIndex] ?? ''}
                      onChange={(e) =>
                        setSlotNames((prev) => ({
                          ...prev,
                          [slot.slotIndex]: e.target.value,
                        }))
                      }
                      onBlur={() => void handleRename(slot.slotIndex)}
                      placeholder="Untitled save"
                      maxLength={40}
                      disabled={busySlot !== null}
                      className="w-full rounded-md border border-white/10 bg-white/5 py-1 pl-7 pr-2 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleSave(slot.slotIndex)}
                      disabled={busySlot !== null}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {busySlot === slot.slotIndex ? (
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Save
                    </button>
                    <button
                      onClick={() => void handleLoad(slot.slotIndex)}
                      disabled={busySlot !== null || !slot.createdAt}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {busySlot === slot.slotIndex ? (
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      Load
                    </button>
                    <button
                      onClick={() => void handleDelete(slot.slotIndex)}
                      disabled={busySlot !== null || !slot.createdAt}
                      title="Delete save"
                      className="flex items-center justify-center rounded-md bg-red-900/50 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-800/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {feedback && (
              <p className="mt-4 text-center text-xs text-indigo-400">{feedback}</p>
            )}

            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
                Exit
              </p>
              <button
                onClick={() => navigate(cameFromEditor ? `/editor/${gameId}` : '/')}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600/80 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                {cameFromEditor ? 'Exit to Editor' : 'Exit to Home'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
