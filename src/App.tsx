import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, Square, RotateCcw, Image as ImageIcon, 
  Settings2, Plus, Flag, Trash2, Rocket, Brush, X, Grid, Pencil, Monitor, Save, FolderOpen,
  Undo2, Redo2, Copy
} from 'lucide-react';
import { motion } from 'motion/react';
import { Stage } from './components/Stage';
import { Palette } from './components/Palette';
import { Workspace } from './components/Workspace';
import { DragOverlayView } from './components/DragOverlayView';
import { SpriteGallery } from './components/SpriteGallery';
import { BackgroundGallery } from './components/BackgroundGallery';
import { PaintEditor, Shape } from './components/PaintEditor';
import { KidKeypad, KeypadMode } from './components/KidKeypad';
import { TextEditorModal, FontSize, SceneText } from './components/TextEditorModal';
import { RecordModal } from './components/RecordModal';
import { SceneThumbnail } from './components/SceneThumbnail';
import { cn } from './lib/utils';
import { BlockType, BlockInstance, Stack, isTriggerBlock } from './blocks';
import { DragState } from './dragState';
import { detachBlock, attachBlock, cloneBlocks, sanitizeStacks } from './workspaceUtils';
import { getAssetUrl } from './utils/assets';
import { playSoundEffect } from './utils/soundEffects';

const INITIAL_SPRITE_STATE = {
  x: 11,
  y: 8,
  homeX: 11,
  homeY: 8,
  rotation: 0,
  scale: 1.2,
  flipX: false,
  visible: true,
  sayText: '',
  speedDelay: 100, // Default Medium
  lastAnimationDuration: 0
};

const DELAY_MS = 100; // Time between blocks (Medium)

export default function App() {
  const [scenes, setScenes] = useState<{ 
    id: string; 
    characters?: { id: string; name: string; spriteUrl: string; shapes?: Shape[] }[];
    spriteStates?: Record<string, typeof INITIAL_SPRITE_STATE>;
    characterStacks?: Record<string, Stack[]>;
    stacks: Stack[]; 
    background?: string; 
    backgroundShapes?: Shape[];
    texts?: SceneText[];
    text?: string; 
    textColor?: string; 
    textSize?: FontSize; 
    textPosition?: { x: number, y: number } 
  }[]>([
    { 
      id: 'scene-1', 
      characters: [
        { id: 'char-1', name: 'Logi', spriteUrl: getAssetUrl('/sprites/logi.png') }
      ],
      spriteStates: {
        'char-1': INITIAL_SPRITE_STATE
      },
      characterStacks: {
        'char-1': []
      },
      stacks: [], 
      background: '', 
      texts: [],
      text: '', 
      textColor: '#000000', 
      textSize: 'medium', 
      textPosition: { x: 10, y: 13 } 
    }
  ]);
  const scenesRef = useRef(scenes);
  useEffect(() => {
    scenesRef.current = scenes;
  }, [scenes]);

  const [activeSceneId, setActiveSceneId] = useState('scene-1');
  const [isBackgroundGalleryOpen, setIsBackgroundGalleryOpen] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [activeCharacterId, setActiveCharacterId] = useState('char-1');
  const [showGrid, setShowGrid] = useState(false);
  const [windowSize, setWindowSize] = useState({ 
    width: typeof window !== 'undefined' ? window.innerWidth : 1024, 
    height: typeof window !== 'undefined' ? window.innerHeight : 768 
  });
  const [showMobileWarning, setShowMobileWarning] = useState(true);
  const [armedDeleteCharId, setArmedDeleteCharId] = useState<string | null>(null);
  const [armedDeleteSceneId, setArmedDeleteSceneId] = useState<string | null>(null);
  const deleteHoldTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (armedDeleteCharId || armedDeleteSceneId) {
      const timer = setTimeout(() => {
        setArmedDeleteCharId(null);
        setArmedDeleteSceneId(null);
      }, 3000); // Reset after 3 seconds of inactivity
      return () => clearTimeout(timer);
    }
  }, [armedDeleteCharId, armedDeleteSceneId]);


  const activeScene = scenes.find(s => s.id === activeSceneId) || scenes[0];
  const characters = activeScene?.characters || [];
  const spriteStates = activeScene?.spriteStates || {};
  const spriteState = spriteStates[activeCharacterId] || INITIAL_SPRITE_STATE;
  const currentSceneTexts: SceneText[] = (activeScene?.texts && activeScene.texts.length > 0)
    ? activeScene.texts
    : (activeScene?.text ? [{
        id: 'legacy-scene-title',
        text: activeScene.text,
        color: activeScene.textColor || '#000000',
        size: activeScene.textSize || 'medium',
        x: activeScene.textPosition?.x ?? 10.5,
        y: activeScene.textPosition?.y ?? 13
      }] : []);

  const updateScenes = (updater: React.SetStateAction<{ 
    id: string; 
    characters?: { id: string; name: string; spriteUrl: string; shapes?: Shape[] }[];
    spriteStates?: Record<string, typeof INITIAL_SPRITE_STATE>;
    characterStacks?: Record<string, Stack[]>;
    stacks: Stack[]; 
    background?: string; 
    backgroundShapes?: Shape[];
    texts?: SceneText[];
    text?: string; 
    textColor?: string; 
    textSize?: FontSize; 
    textPosition?: { x: number, y: number } 
  }[]>) => {
    // Update ref immediately so async code (like runBlocks) sees the change
    const next = typeof updater === 'function' ? (updater as any)(scenesRef.current) : updater;
    scenesRef.current = next;
    
    // Then trigger React state update
    setScenes(next);
  };

  const shouldStopRef = useRef(false);
  const stoppedCharactersRef = useRef<Set<string>>(new Set());
  const isCharStopped = (charId: string) => shouldStopRef.current || stoppedCharactersRef.current.has(charId);
  const delayMsRef = useRef(DELAY_MS);
  const autoPlayNextSceneRef = useRef<string | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const activeRunsCountRef = useRef(0);
  const runningStacksRef = useRef<Set<string>>(new Set());

  const resetStage = () => {
    console.log('Resetting stage...');
    shouldStopRef.current = true;
    stoppedCharactersRef.current.clear();
    setIsRunning(false);
    setActiveBlockId(null);
    activeRunsCountRef.current = 0;
    runningStacksRef.current.clear();
    setSpriteStates(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        const current = next[key] || INITIAL_SPRITE_STATE;
        const hX = current.homeX !== undefined ? current.homeX : INITIAL_SPRITE_STATE.x;
        const hY = current.homeY !== undefined ? current.homeY : INITIAL_SPRITE_STATE.y;
        next[key] = {
          ...INITIAL_SPRITE_STATE,
          x: hX,
          y: hY,
          homeX: hX,
          homeY: hY,
          sayText: '',
          lastAnimationDuration: 0
        };
      });
      return next;
    });
  };

  const setCharacters = (updater: React.SetStateAction<{ id: string; name: string; spriteUrl: string; shapes?: Shape[] }[]>) => {
    updateScenes(prev => prev.map(s => {
      if (s.id === activeSceneId) {
        const currentChars = s.characters || [];
        const nextChars = typeof updater === 'function' ? (updater as any)(currentChars) : updater;
        return { ...s, characters: nextChars };
      }
      return s;
    }));
  };

  const setSpriteStates = (updater: React.SetStateAction<Record<string, typeof INITIAL_SPRITE_STATE>>) => {
    updateScenes(prev => prev.map(s => {
      if (s.id === activeSceneId) {
        const currentStates = s.spriteStates || {};
        const nextStates = typeof updater === 'function' ? (updater as any)(currentStates) : updater;
        return { ...s, spriteStates: nextStates };
      }
      return s;
    }));
  };

  const setSpriteState = (updater: React.SetStateAction<typeof INITIAL_SPRITE_STATE>) => {
    setSpriteStates(prevMap => {
      const current = prevMap[activeCharacterId] || INITIAL_SPRITE_STATE;
      const next = typeof updater === 'function' ? (updater as any)(current) : { ...updater };
      
      // Wrap-around logic in grid coordinates:
      // X coordinates are columns 1 to 20.
      // Y coordinates are rows 1 to 15.
      // If a character moves beyond column 22, it wraps to -1 (offscreen left).
      // If a character moves below column -1, it wraps to 22 (offscreen right).
      // If a character moves beyond row 17, it wraps to -1 (offscreen bottom).
      // If a character moves below row -1, it wraps to 17 (offscreen top).
      const MIN_X = -1;
      const MAX_X = 22;
      const MIN_Y = -1;
      const MAX_Y = 17;

      if (next.x > MAX_X) {
        next.x = MIN_X;
      } else if (next.x < MIN_X) {
        next.x = MAX_X;
      }

      if (next.y > MAX_Y) {
        next.y = MIN_Y;
      } else if (next.y < MIN_Y) {
        next.y = MAX_Y;
      }

      return {
        ...prevMap,
        [activeCharacterId]: next
      };
    });
  };

  const setSpriteStateForChar = (charId: string, updater: React.SetStateAction<typeof INITIAL_SPRITE_STATE>) => {
    setSpriteStates(prevMap => {
      const current = prevMap[charId] || INITIAL_SPRITE_STATE;
      const next = typeof updater === 'function' ? (updater as any)(current) : { ...updater };
      
      const MIN_X = -1;
      const MAX_X = 22;
      const MIN_Y = -1;
      const MAX_Y = 17;

      if (next.x > MAX_X) {
        next.x = MIN_X;
      } else if (next.x < MIN_X) {
        next.x = MAX_X;
      }

      if (next.y > MAX_Y) {
        next.y = MIN_Y;
      } else if (next.y < MIN_Y) {
        next.y = MAX_Y;
      }

      return {
        ...prevMap,
        [charId]: next
      };
    });
  };

  const [isRunning, setIsRunning] = useState(false);
  const [activeBlockIds, setActiveBlockIds] = useState<string[]>([]);

  const addActiveBlockId = (id: string) => {
    setActiveBlockIds(prev => prev.includes(id) ? prev : [...prev, id]);
  };

  const removeActiveBlockId = (id: string) => {
    setActiveBlockIds(prev => prev.filter(item => item !== id));
  };

  const clearActiveBlockIds = () => {
    setActiveBlockIds([]);
  };

  const activeBlockId = activeBlockIds.length > 0 ? activeBlockIds[activeBlockIds.length - 1] : null;
  const setActiveBlockId = (id: string | null) => {
    if (!id) {
      clearActiveBlockIds();
    } else {
      addActiveBlockId(id);
    }
  };

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const handleSaveTextModal = (text: string, color: string, size: FontSize) => {
    const trimmed = text.trim();
    if (!trimmed) {
      if (editingTextId) {
        handleDeleteText(editingTextId);
      }
      setIsTextModalOpen(false);
      setEditingTextId(null);
      return;
    }

    updateScenes(prev => prev.map(s => {
      if (s.id !== activeSceneId) return s;
      const currentTexts = s.texts ? [...s.texts] : (s.text ? [{
        id: 'legacy-scene-title',
        text: s.text,
        color: s.textColor || '#000000',
        size: s.textSize || 'medium',
        x: s.textPosition?.x ?? 10.5,
        y: s.textPosition?.y ?? 13
      }] : []);

      if (editingTextId) {
        const nextTexts = currentTexts.map(t => 
          t.id === editingTextId ? { ...t, text: trimmed, color, size } : t
        );
        return {
          ...s,
          texts: nextTexts,
          text: nextTexts[0]?.text || '',
          textColor: nextTexts[0]?.color,
          textSize: nextTexts[0]?.size,
          textPosition: nextTexts[0] ? { x: nextTexts[0].x, y: nextTexts[0].y } : s.textPosition
        };
      } else {
        const count = currentTexts.length;
        const newTextObj: SceneText = {
          id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          text: trimmed,
          color,
          size,
          x: 10.5,
          y: Math.max(2, 13 - (count * 2.2))
        };
        const nextTexts = [...currentTexts, newTextObj];
        return {
          ...s,
          texts: nextTexts,
          text: nextTexts[0]?.text || '',
          textColor: nextTexts[0]?.color,
          textSize: nextTexts[0]?.size,
          textPosition: nextTexts[0] ? { x: nextTexts[0].x, y: nextTexts[0].y } : s.textPosition
        };
      }
    }));

    setIsTextModalOpen(false);
    setEditingTextId(null);
  };

  const handleDeleteText = (textId: string) => {
    updateScenes(prev => prev.map(s => {
      if (s.id !== activeSceneId) return s;
      const currentTexts = s.texts ? [...s.texts] : (s.text ? [{
        id: 'legacy-scene-title',
        text: s.text,
        color: s.textColor || '#000000',
        size: s.textSize || 'medium',
        x: s.textPosition?.x ?? 10.5,
        y: s.textPosition?.y ?? 13
      }] : []);
      const nextTexts = currentTexts.filter(t => t.id !== textId);
      return {
        ...s,
        texts: nextTexts,
        text: nextTexts[0]?.text || '',
        textColor: nextTexts[0]?.color || '#000000',
        textSize: nextTexts[0]?.size || 'medium',
        textPosition: nextTexts[0] ? { x: nextTexts[0].x, y: nextTexts[0].y } : undefined
      };
    }));
    if (editingTextId === textId) {
      setEditingTextId(null);
      setIsTextModalOpen(false);
    }
  };

  const handleUpdateSceneTextPosition = (textId: string, x: number, y: number) => {
    updateScenes(prev => prev.map(s => {
      if (s.id !== activeSceneId) return s;
      const currentTexts = s.texts ? [...s.texts] : (s.text ? [{
        id: 'legacy-scene-title',
        text: s.text,
        color: s.textColor || '#000000',
        size: s.textSize || 'medium',
        x: s.textPosition?.x ?? 10.5,
        y: s.textPosition?.y ?? 13
      }] : []);
      const nextTexts = currentTexts.map(t => t.id === textId ? { ...t, x, y } : t);
      return {
        ...s,
        texts: nextTexts,
        textPosition: nextTexts[0] ? { x: nextTexts[0].x, y: nextTexts[0].y } : s.textPosition
      };
    }));
  };

  const handleEditText = (textId: string) => {
    setEditingTextId(textId);
    setIsTextModalOpen(true);
  };
  const [isPaintEditorOpen, setIsPaintEditorOpen] = useState(false);
  const handleDeleteRecording = (id: number) => {
    setRecordings(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordings, setRecordings] = useState<Record<number, string>>({});
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [editingBackground, setEditingBackground] = useState<{ name: string; url: string; shapes?: Shape[] } | null>(null);
  
  // Custom Kid-Friendly Keypad State
  const [keypadConfig, setKeypadConfig] = useState<{
    isOpen: boolean;
    mode: KeypadMode;
    title: string;
    initialValue: string;
    onConfirm: (val: string) => void;
    anchorRect?: DOMRect;
  }>({
    isOpen: false,
    mode: 'number',
    title: '',
    initialValue: '',
    onConfirm: () => {}
  });

  const handleOpenKeypad = (
    mode: KeypadMode,
    title: string,
    initialValue: string,
    onConfirm: (val: string) => void,
    anchorRect?: DOMRect
  ) => {
    setKeypadConfig({
      isOpen: true,
      mode,
      title,
      initialValue,
      onConfirm,
      anchorRect
    });
  };
  
  const stacks = activeScene?.characterStacks?.[activeCharacterId] || activeScene?.stacks || [];

  const setStacks = (action: React.SetStateAction<Stack[]>) => {
    updateScenes(prev => prev.map(s => {
      if (s.id === activeSceneId) {
        const currentStacks = s.characterStacks?.[activeCharacterId] || s.stacks || [];
        const nextStacks = typeof action === 'function' ? (action as any)(currentStacks) : action;
        const nextCharacterStacks = {
          ...(s.characterStacks || {}),
          [activeCharacterId]: nextStacks
        };
        return { 
          ...s, 
          characterStacks: nextCharacterStacks,
          stacks: nextStacks 
        };
      }
      return s;
    }));
  };

  // Undo / Redo History for Workspace Blocks
  const [undoHistory, setUndoHistory] = useState<Stack[][]>([]);
  const [redoHistory, setRedoHistory] = useState<Stack[][]>([]);

  // Reset history when active character or active scene changes
  useEffect(() => {
    setUndoHistory([]);
    setRedoHistory([]);
  }, [activeCharacterId, activeSceneId]);

  const saveToUndo = useCallback((prevStacks: Stack[]) => {
    setUndoHistory(prev => {
      const cloned = JSON.parse(JSON.stringify(prevStacks));
      return [...prev.slice(-29), cloned];
    });
    setRedoHistory([]);
  }, []);

  const handleUndo = () => {
    if (undoHistory.length === 0) return;
    const previous = undoHistory[undoHistory.length - 1];
    const newUndo = undoHistory.slice(0, undoHistory.length - 1);
    const currentCloned = JSON.parse(JSON.stringify(stacks));

    setRedoHistory(r => [...r, currentCloned]);
    setUndoHistory(newUndo);

    setStacks(previous);
  };

  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    const next = redoHistory[redoHistory.length - 1];
    const newRedo = redoHistory.slice(0, redoHistory.length - 1);
    const currentCloned = JSON.parse(JSON.stringify(stacks));

    setUndoHistory(u => [...u, currentCloned]);
    setRedoHistory(newRedo);

    setStacks(next);
  };

  const playConnectSound = useCallback(() => {
    try {
      const audio = new Audio(getAssetUrl('/sound/scratchjr_block_connect.wav'));
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Failed to play connect sound:', e));
    } catch (e) {
      console.log('Audio error:', e);
    }
  }, []);

  const playDeleteSound = useCallback(() => {
    try {
      const audio = new Audio(getAssetUrl('/sound/whoosh.mp3'));
      audio.volume = 0.6;
      audio.play().catch(e => console.log('Failed to play delete sound:', e));
    } catch (e) {
      console.log('Audio error:', e);
    }
  }, []);

  // --- Drag and Drop State ---
  const [dragState, setDragState] = useState<DragState | null>(null);
  const snapTargetRef = useRef<{ containerId: string; afterId: string } | null>(null);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!dragState?.isDragging) return;
      
      setDragState(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);

      // Find snap target
      document.querySelectorAll('.block-socket').forEach(el => el.classList.remove('bg-yellow-400', 'opacity-50'));
      document.querySelectorAll('.character-drop-target').forEach(el => el.classList.remove('ring-4', 'ring-[#E5C470]', 'scale-105'));
      document.querySelectorAll('.scene-drop-target').forEach(el => el.classList.remove('ring-4', 'ring-[#E5C470]', 'ring-emerald-500', 'shadow-[0_0_20px_rgba(16,185,129,0.8)]', 'scale-105'));
      snapTargetRef.current = null;

      const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
      const characterElement = elementAtPoint?.closest('.character-drop-target');
      if (characterElement && characterElement.getAttribute('data-character-id') !== activeCharacterId && dragState.source !== 'CHARACTER') {
        characterElement.classList.add('ring-4', 'ring-[#E5C470]', 'scale-105');
      }

      const sceneElement = elementAtPoint?.closest('.scene-drop-target');
      if (sceneElement && sceneElement.getAttribute('data-scene-id') !== activeSceneId && dragState.source === 'CHARACTER') {
        sceneElement.classList.add('ring-4', 'ring-emerald-500', 'shadow-[0_0_20px_rgba(16,185,129,0.8)]', 'scale-105');
      }

      const isDraggingTrigger = dragState.source === 'PALETTE' 
        ? Boolean(dragState.blockType && isTriggerBlock(dragState.blockType))
        : Boolean(dragState.blocks && dragState.blocks.length > 0 && isTriggerBlock(dragState.blocks[0].type));

      if (!isDraggingTrigger) {
        const sockets = document.querySelectorAll('.block-socket');
        let closest: Element | null = null;
        let minDistance = 80; // increased snap threshold in px

        sockets.forEach(socket => {
          const containerId = (socket as HTMLElement).dataset.containerId;
          if (containerId === 'preview') return; // Ignore sockets belonging to the dragging preview

          const rect = socket.getBoundingClientRect();
          // Socket center
          const sx = rect.left + rect.width / 2;
          const sy = rect.top + rect.height / 2;
          
          // Use the connection point of the dragged block for snapping
          // ScratchJr blocks connect at the left side (peg)
          const blockLeft = e.clientX - (dragState.offsetX || 0);
          const blockTop = e.clientY - (dragState.offsetY || 0);
          
          const px = blockLeft + 10; // Offset slightly to account for the peg shape
          const py = blockTop + 32;  // Vertical center of the block (height is 64px)

          const dx = Math.abs(sx - px);
          const dy = Math.abs(sy - py);

          // Snapping only occurs if the block is vertically close to the row (dy < 40px)
          // and horizontally reasonably close (dx < 80px)
          if (dy < 40 && dx < 80) {
            const dist = Math.hypot(dx, dy);
            if (dist < minDistance) {
              minDistance = dist;
              closest = socket;
            }
          }
        });

        if (closest) {
          (closest as Element).classList.add('bg-yellow-400', 'opacity-50');
          snapTargetRef.current = {
            containerId: (closest as HTMLElement).dataset.containerId!,
            afterId: (closest as HTMLElement).dataset.afterId!
          };
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!dragState?.isDragging) return;

      document.querySelectorAll('.block-socket').forEach(el => el.classList.remove('bg-yellow-400', 'opacity-50'));
      document.querySelectorAll('.character-drop-target').forEach(el => el.classList.remove('ring-4', 'ring-[#E5C470]', 'scale-105'));
      document.querySelectorAll('.scene-drop-target').forEach(el => el.classList.remove('ring-4', 'ring-[#E5C470]', 'ring-emerald-500', 'shadow-[0_0_20px_rgba(16,185,129,0.8)]', 'scale-105'));
      
      const target = snapTargetRef.current;
      const workspaceRect = workspaceRef.current?.getBoundingClientRect();

      // Check if dropping over a character in the sidebar for copying
      const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
      const characterElement = elementAtPoint?.closest('.character-drop-target');
      const targetCharId = characterElement?.getAttribute('data-character-id');

      // Check if dropping over a scene in the right sidebar
      const sceneElement = elementAtPoint?.closest('.scene-drop-target');
      const targetSceneId = sceneElement?.getAttribute('data-scene-id');

      if (dragState.source === 'CHARACTER') {
        const wasCharClick = Math.abs(e.clientX - dragState.startX) < 5 && 
                             Math.abs(e.clientY - dragState.startY) < 5;
        
        if (wasCharClick) {
          setDragState(null);
          return;
        }

        if (targetSceneId && targetSceneId !== activeSceneId) {
          // SCRATCH JR STYLE COPY: Character with its code to another scene
          const charToCopy = characters.find(c => c.id === dragState.characterId);
          if (charToCopy) {
            const newCharId = `char-${Date.now()}`;
            const newChar = { ...charToCopy, id: newCharId };
            
            // Clone all stacks for this character from current scene
            const characterStacks = activeScene?.characterStacks || {};
            const charStacksToCopy = characterStacks[dragState.characterId!] || [];
            
            const clonedStacks = charStacksToCopy.map(s => ({
              ...s,
              id: `stack-${Date.now()}-${Math.random()}`,
              blocks: cloneBlocks(s.blocks)
            }));

            updateScenes(prev => prev.map(s => {
              if (s.id === targetSceneId) {
                const updatedCharacters = [...(s.characters || []), newChar];
                const updatedStacks = { 
                  ...(s.characterStacks || {}),
                  [newCharId]: clonedStacks
                };
                return {
                  ...s,
                  characters: updatedCharacters,
                  characterStacks: updatedStacks
                };
              }
              return s;
            }));
          }
        }
        
        setDragState(null);
        return;
      }

      let finalBlocks: BlockInstance[] = [];
      const wasClick = dragState.source === 'WORKSPACE' && 
                       Math.abs(e.clientX - dragState.startX) < 5 && 
                       Math.abs(e.clientY - dragState.startY) < 5;

      if (dragState.source === 'PALETTE' && dragState.blockType) {
        const newBlock: BlockInstance = {
          id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: dragState.blockType,
        };
        
        if (dragState.times !== undefined) {
          newBlock.times = dragState.times;
        } else if (['MOVE_RIGHT', 'MOVE_LEFT', 'MOVE_UP', 'MOVE_DOWN', 'TURN_RIGHT', 'TURN_LEFT', 'GROW', 'SHRINK'].includes(dragState.blockType)) {
          newBlock.times = 1;
        } else if (dragState.blockType === 'HOP') {
          newBlock.times = 2;
        } else if (dragState.blockType === 'WAIT') {
          newBlock.times = 10;
        } else if (dragState.blockType === 'SET_SPEED') {
          newBlock.times = 2;
        } else if (dragState.blockType === 'SAY') {
          newBlock.text = 'Hello!';
        } else if (dragState.blockType === 'REPEAT') {
          newBlock.times = 4;
          newBlock.children = [];
        } else if (dragState.blockType === 'GOTO_PAGE') {
          newBlock.times = 2;
        } else if (['START_GET_MESSAGE', 'SEND_MESSAGE'].includes(dragState.blockType)) {
          newBlock.text = 'orange';
        } else if (dragState.blockType === 'POP') {
          newBlock.text = 'pop';
        }
        finalBlocks = [newBlock];
      } else if (dragState.source === 'WORKSPACE' && dragState.blocks) {
        finalBlocks = dragState.blocks;
      }

      if (targetCharId && targetCharId !== activeCharacterId && finalBlocks.length > 0) {
        // SCRATCH JR STYLE COPY: Drop on another character
        const clonedBlocks = cloneBlocks(finalBlocks);
        const newStack: Stack = {
          id: `stack-${Date.now()}`,
          x: 20, // Default position in new character's workspace
          y: 20,
          blocks: clonedBlocks
        };

        updateScenes(prev => prev.map(s => {
          if (s.id === activeSceneId) {
            const charStacks = s.characterStacks || {};
            return {
              ...s,
              characterStacks: {
                ...charStacks,
                [targetCharId]: [...(charStacks[targetCharId] || []), newStack]
              }
            };
          }
          return s;
        }));

        // Restore original stacks for current character if it was a workspace drag
        if (dragState.source === 'WORKSPACE' && dragState.originalStacks) {
          setStacks(dragState.originalStacks);
        }
        
        setDragState(null);
        snapTargetRef.current = null;
        return;
      }

      if (wasClick && dragState.originalStacks) {
        setStacks(dragState.originalStacks);
        const originalStack = dragState.originalStacks.find(s => s.id === dragState.stackId);
        if (originalStack && activeCharacterId) {
          runTracked(originalStack.blocks, activeCharacterId);
        }
        setDragState(null);
        snapTargetRef.current = null;
        return;
      }

      // Save history for Undo before applying changes
      if (dragState.source === 'PALETTE') {
        saveToUndo(stacks);
      } else if (dragState.source === 'WORKSPACE') {
        saveToUndo(dragState.originalStacks || stacks);
      }

      if (finalBlocks.length > 0) {
        if (target) {
          setStacks(prev => attachBlock(prev, target.containerId, target.afterId, finalBlocks));
          playConnectSound();
        } else if (workspaceRect) {
          // Drop on workspace background
          const x = e.clientX - workspaceRect.left - dragState.offsetX;
          const y = e.clientY - workspaceRect.top - dragState.offsetY;
          
          // Only drop if within workspace bounds (mostly)
          if (x > -100 && y > -100 && x < workspaceRect.width && y < workspaceRect.height) {
            const newStack: Stack = {
              id: `stack-${Date.now()}`,
              x: Math.max(0, x),
              y: Math.max(0, y),
              blocks: finalBlocks
            };
            setStacks(prev => [...prev, newStack]);
          }
        }
      }

      setDragState(null);
      snapTargetRef.current = null;
    };

    if (dragState?.isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState]);
  
  useEffect(() => {
    if (autoPlayNextSceneRef.current === activeSceneId) {
      autoPlayNextSceneRef.current = null;
      setTimeout(() => {
        playScene();
      }, 100);
    }
  }, [activeSceneId]);

  useEffect(() => {
    const scene = scenes.find(s => s.id === activeSceneId);
    if (scene && scene.characters && scene.characters.length > 0) {
      const exists = scene.characters.some(c => c.id === activeCharacterId);
      if (!exists) {
        setActiveCharacterId(scene.characters[0].id);
      }
    }
  }, [activeSceneId, scenes, activeCharacterId]);

  const handlePaletteDragStart = (e: React.PointerEvent, type: BlockType, times?: number) => {
    setDragState({
      isDragging: true,
      source: 'PALETTE',
      blockType: type,
      times: times,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      offsetX: 20, // rough offset
      offsetY: 20
    });
  };

  const handleCharacterDragStart = (e: React.PointerEvent, characterId: string) => {
    // Start drag from the sprite image or card center
    setDragState({
      isDragging: true,
      source: 'CHARACTER',
      characterId,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      offsetX: 40,
      offsetY: 40
    });
  };

  const handleCharDeletePointerDown = (e: React.PointerEvent, charId: string) => {
    e.stopPropagation();
    if (armedDeleteCharId === charId) return;
    
    deleteHoldTimerRef.current = setTimeout(() => {
      setArmedDeleteCharId(charId);
      // Optional: haptic feedback could go here
    }, 800);
  };

  const handleCharDeletePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (deleteHoldTimerRef.current) {
      clearTimeout(deleteHoldTimerRef.current);
      deleteHoldTimerRef.current = null;
    }
  };

  const handleSceneDeletePointerDown = (e: React.PointerEvent, sceneId: string) => {
    e.stopPropagation();
    if (armedDeleteSceneId === sceneId) return;
    
    deleteHoldTimerRef.current = setTimeout(() => {
      setArmedDeleteSceneId(sceneId);
    }, 800);
  };

  const handleSceneDeletePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (deleteHoldTimerRef.current) {
      clearTimeout(deleteHoldTimerRef.current);
      deleteHoldTimerRef.current = null;
    }
  };

  const handleWorkspaceDragStart = (e: React.PointerEvent, stackId: string, blockId: string) => {
    // We need to find the block's current client rect to get the exact offset!
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    setStacks(prev => {
      const { newStacks, detachedBlocks } = detachBlock(prev, stackId, blockId);
      
      setTimeout(() => {
        setDragState({
          isDragging: true,
          source: 'WORKSPACE',
          stackId,
          blockId,
          blocks: detachedBlocks,
          startX: e.clientX,
          startY: e.clientY,
          currentX: e.clientX,
          currentY: e.clientY,
          offsetX: e.clientX - rect.left,
          offsetY: e.clientY - rect.top,
          originalStacks: prev
        });
      }, 0);
      
      return newStacks;
    });
  };

  // --- /Drag and Drop State ---

  const handleTimesChange = (id: string, times: number) => {
    saveToUndo(stacks);
    const updateTimes = (items: BlockInstance[]): BlockInstance[] => {
      return items.map(b => {
        if (b.id === id) return { ...b, times };
        if (b.children) return { ...b, children: updateTimes(b.children) };
        return b;
      });
    };
    setStacks(prev => prev.map(s => ({ ...s, blocks: updateTimes(s.blocks) })));
  };

  const handleTextChange = (id: string, text: string) => {
    saveToUndo(stacks);
    const updateText = (items: BlockInstance[]): BlockInstance[] => {
      return items.map(b => {
        if (b.id === id) return { ...b, text };
        if (b.children) return { ...b, children: updateText(b.children) };
        return b;
      });
    };
    setStacks(prev => prev.map(s => ({ ...s, blocks: updateText(s.blocks) })));
  };

  const handleDeleteBlock = (blockId: string) => {
    // Handled by dragging into the void, or add a specific trash zone later.
  };

  const clearWorkspace = () => {
    if (stacks.length > 0) {
      saveToUndo(stacks);
    }
    setStacks([]);
    resetStage();
  };

  const handleAddScene = () => {
    const newSceneId = `scene-${Date.now()}`;
    const defaultCharId = `char-${Date.now()}`;
    const defaultChar = { id: defaultCharId, name: 'Logi', spriteUrl: getAssetUrl('/sprites/logi.png') };
    
    updateScenes([...scenes, { 
      id: newSceneId, 
      characters: [defaultChar],
      spriteStates: {
        [defaultCharId]: INITIAL_SPRITE_STATE
      },
      characterStacks: {
        [defaultCharId]: []
      },
      stacks: [], 
      background: '',
      texts: []
    }]);
    setActiveSceneId(newSceneId);
    setActiveCharacterId(defaultCharId);
  };

  const handleDeleteScene = (id: string) => {
    if (scenes.length <= 1) return;
    playDeleteSound();
    updateScenes(prev => prev.filter(s => s.id !== id));
    if (activeSceneId === id) {
      const remaining = scenes.filter(s => s.id !== id);
      setActiveSceneId(remaining[0].id);
    }
  };

  const handleSelectBackground = (bg: { name: string; url: string; shapes?: Shape[] }) => {
    updateScenes(prev => prev.map(s => {
      if (s.id === activeSceneId) {
        return { ...s, background: bg.url, backgroundShapes: bg.shapes };
      }
      return s;
    }));
    setIsBackgroundGalleryOpen(false);
  };

  const handleSelectSprite = (sprite: { name: string; url: string }) => {
    const newCharId = `char-${Date.now()}`;
    setCharacters(prev => [...prev, { id: newCharId, name: sprite.name, spriteUrl: sprite.url }]);
    setSpriteStates(prev => ({
      ...prev,
      [newCharId]: INITIAL_SPRITE_STATE
    }));
    updateScenes(prev => prev.map(s => {
      if (s.id === activeSceneId) {
        return {
          ...s,
          characterStacks: {
            ...(s.characterStacks || {}),
            [newCharId]: []
          }
        };
      }
      return s;
    }));
    setActiveCharacterId(newCharId);
    setIsGalleryOpen(false);
  };

  const handleDeleteCharacter = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (characters.length <= 1) return;
    playDeleteSound();
    setCharacters(prev => prev.filter(c => c.id !== id));
    setSpriteStates(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    updateScenes(prev => prev.map(s => {
      if (s.id === activeSceneId && s.characterStacks) {
        const nextStacks = { ...s.characterStacks };
        delete nextStacks[id];
        return { ...s, characterStacks: nextStacks };
      }
      return s;
    }));
    if (activeCharacterId === id) {
      const remaining = characters.filter(c => c.id !== id);
      setActiveCharacterId(remaining[0].id);
    }
  };

  const handleDuplicateCharacter = (sourceId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const sourceChar = characters.find(c => c.id === sourceId);
    if (!sourceChar) return;

    // Generate unique name e.g. "Cat 2"
    const baseName = sourceChar.name.replace(/\s+\d+$/, '');
    let counter = 2;
    let newName = `${baseName} ${counter}`;
    while (characters.some(c => c.name === newName)) {
      counter++;
      newName = `${baseName} ${counter}`;
    }

    const newCharId = `char-${Date.now()}`;
    const newChar = {
      ...sourceChar,
      id: newCharId,
      name: newName,
    };

    // Duplicate spriteState with a position offset
    const sourceState = spriteStates[sourceId] || INITIAL_SPRITE_STATE;
    const newSpriteState = {
      ...sourceState,
      x: Math.min(19, (sourceState.x ?? 11) + 2),
      y: Math.max(1, (sourceState.y ?? 8) - 1),
      homeX: Math.min(19, (sourceState.homeX ?? sourceState.x ?? 11) + 2),
      homeY: Math.max(1, (sourceState.homeY ?? sourceState.y ?? 8) - 1),
    };

    setSpriteStates(prev => ({
      ...prev,
      [newCharId]: newSpriteState
    }));

    // Clone characterStacks across scenes
    updateScenes(prev => prev.map(s => {
      const sourceStacks = s.characterStacks?.[sourceId] || [];
      const duplicatedStacks = sourceStacks.map(stack => ({
        id: `stack-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        x: stack.x,
        y: stack.y,
        blocks: cloneBlocks(stack.blocks)
      }));

      return {
        ...s,
        characterStacks: {
          ...(s.characterStacks || {}),
          [newCharId]: duplicatedStacks
        }
      };
    }));

    playConnectSound();
    setCharacters(prev => [...prev, newChar]);
    setActiveCharacterId(newCharId);
  };

  const handleUpdateCharacterName = (id: string, newName: string) => {
    setCharacters(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c));
    setKeypadConfig(prev => ({ ...prev, isOpen: false }));
  };

  const triggerBumpEvents = (sourceId: string, targetId: string) => {
    const activeScene = scenesRef.current.find(s => s.id === activeSceneId);
    if (!activeScene) return;
    
    const characterStacks = activeScene.characterStacks || {};
    const targetStacks = characterStacks[targetId] || [];
    
    targetStacks.forEach(s => {
      const firstBlock = s.blocks[0];
      if (firstBlock && firstBlock.type === 'START_BUMP') {
        const triggerCharId = firstBlock.text || 'any';
        if (triggerCharId === 'any' || triggerCharId === sourceId) {
          runTracked(s.blocks, targetId);
        }
      }
    });
  };

  const checkForCollisions = (movingCharId: string) => {
    const activeScene = scenesRef.current.find(s => s.id === activeSceneId);
    if (!activeScene || !activeScene.spriteStates) return;

    const movingCharState = activeScene.spriteStates[movingCharId];
    if (!movingCharState) return;

    Object.entries(activeScene.spriteStates).forEach(([otherCharId, otherState]) => {
      if (movingCharId === otherCharId) return;
      
      const other = otherState as typeof INITIAL_SPRITE_STATE;
      
      // Simple distance check in grid units
      const dx = movingCharState.x - other.x;
      const dy = movingCharState.y - other.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // If distance is less than 1.2 grid units (considering character size)
      if (distance < 1.2) {
        triggerBumpEvents(movingCharId, otherCharId);
        triggerBumpEvents(otherCharId, movingCharId);
      }
    });
  };

  const runBlocks = async (blockList: BlockInstance[], charId: string = activeCharacterId, isForever: boolean = false) => {
    if (!blockList || blockList.length === 0 || isCharStopped(charId)) return;

    const triggerBlockTypes = ['START_FLAG', 'START_TOUCH', 'START_BUMP', 'START_GET_MESSAGE'];
    let executableBlocks = blockList;
    const firstBlock = blockList[0];

    if (firstBlock && triggerBlockTypes.includes(firstBlock.type)) {
      addActiveBlockId(firstBlock.id);
      await new Promise(r => setTimeout(r, 60));
      removeActiveBlockId(firstBlock.id);
      executableBlocks = blockList.slice(1);
    }

    if (executableBlocks.length === 0 || isCharStopped(charId)) return;

    const endsWithForever = executableBlocks.length > 0 && executableBlocks[executableBlocks.length - 1].type === 'REPEAT_FOREVER';
    
    if (endsWithForever) {
      const loopBlocks = executableBlocks.slice(0, -1);
      const foreverBlock = executableBlocks[executableBlocks.length - 1];
      
      while (!isCharStopped(charId)) {
        for (const block of loopBlocks) {
          if (isCharStopped(charId)) break;
          await runBlocks([block], charId, true);
        }
        if (isCharStopped(charId)) break;
        
        if (foreverBlock) {
          addActiveBlockId(foreverBlock.id);
          await new Promise(r => setTimeout(r, 20));
          removeActiveBlockId(foreverBlock.id);
        }
      }
      return;
    }

    for (const block of executableBlocks) {
      if (isCharStopped(charId)) break;
      
      addActiveBlockId(block.id);
      
      // Get the character's specific speed
      const charState = (scenesRef.current.find(s => s.id === activeSceneId)?.spriteStates?.[charId]) || INITIAL_SPRITE_STATE;
      const charDelay = charState.speedDelay !== undefined ? charState.speedDelay : 100;
      const GAP_COMPENSATION = 20; // ms

      switch (block.type) {
        case 'MOVE_RIGHT': {
          const steps = block.times !== undefined ? block.times : 1;
          for (let i = 0; i < steps; i++) {
            if (isCharStopped(charId)) break;
            setSpriteStateForChar(charId, prev => ({ 
              ...prev, 
              x: prev.x + 1,
              flipX: false,
              lastAnimationDuration: charDelay / 1000 
            }));
            await new Promise(r => setTimeout(r, charDelay));
            checkForCollisions(charId);
          }
          break;
        }
        case 'MOVE_LEFT': {
          const steps = block.times !== undefined ? block.times : 1;
          for (let i = 0; i < steps; i++) {
            if (isCharStopped(charId)) break;
            setSpriteStateForChar(charId, prev => ({ 
              ...prev, 
              x: prev.x - 1,
              flipX: true,
              lastAnimationDuration: charDelay / 1000 
            }));
            await new Promise(r => setTimeout(r, charDelay));
            checkForCollisions(charId);
          }
          break;
        }
        case 'MOVE_UP': {
          const steps = block.times !== undefined ? block.times : 1;
          for (let i = 0; i < steps; i++) {
            if (isCharStopped(charId)) break;
            setSpriteStateForChar(charId, prev => ({ 
              ...prev, 
              y: prev.y + 1,
              lastAnimationDuration: charDelay / 1000 
            }));
            await new Promise(r => setTimeout(r, charDelay));
            checkForCollisions(charId);
          }
          break;
        }
        case 'MOVE_DOWN': {
          const steps = block.times !== undefined ? block.times : 1;
          for (let i = 0; i < steps; i++) {
            if (isCharStopped(charId)) break;
            setSpriteStateForChar(charId, prev => ({ 
              ...prev, 
              y: prev.y - 1,
              lastAnimationDuration: charDelay / 1000 
            }));
            await new Promise(r => setTimeout(r, charDelay));
            checkForCollisions(charId);
          }
          break;
        }
        case 'TURN_RIGHT': {
          const steps = block.times !== undefined ? block.times : 1;
          const rotationAmount = steps * 30;
          const totalDuration = charDelay * steps;
          setSpriteStateForChar(charId, prev => ({ 
            ...prev, 
            rotation: prev.rotation + rotationAmount,
            lastAnimationDuration: totalDuration / 1000 
          }));
          await new Promise(r => setTimeout(r, totalDuration));
          break;
        }
        case 'TURN_LEFT': {
          const steps = block.times !== undefined ? block.times : 1;
          const rotationAmount = steps * 30;
          const totalDuration = charDelay * steps;
          setSpriteStateForChar(charId, prev => ({ 
            ...prev, 
            rotation: prev.rotation - rotationAmount,
            lastAnimationDuration: totalDuration / 1000 
          }));
          await new Promise(r => setTimeout(r, totalDuration));
          break;
        }
        case 'HOP': {
          const height = block.times !== undefined ? block.times : 2;
          // Hop is two stages: Up then Down. 
          // For HOP, we use a smaller compensation to avoid cutting off the peak too much.
          const HOP_COMP = Math.min(10, GAP_COMPENSATION);
          // Increase base delay for hop to make it more visible
          const hopDuration = charDelay + 150; 
          
          setSpriteStateForChar(charId, prev => ({ 
            ...prev, 
            y: prev.y + height, 
            lastAnimationDuration: (hopDuration + HOP_COMP) / 1000 
          }));
          await new Promise(r => setTimeout(r, Math.max(0, hopDuration - HOP_COMP)));
          checkForCollisions(charId);
          
          setSpriteStateForChar(charId, prev => ({ 
            ...prev, 
            y: prev.y - height, 
            lastAnimationDuration: (hopDuration + HOP_COMP) / 1000 
          }));
          await new Promise(r => setTimeout(r, Math.max(0, hopDuration - HOP_COMP)));
          checkForCollisions(charId);
          break;
        }
        case 'GO_HOME':
          setSpriteStateForChar(charId, prev => ({ ...prev, x: prev.homeX !== undefined ? prev.homeX : 11, y: prev.homeY !== undefined ? prev.homeY : 8, rotation: 0 }));
          break;
        case 'SAY': {
          const text = block.text || 'Hello!';
          setSpriteStateForChar(charId, prev => ({ ...prev, sayText: text }));
          await new Promise(r => setTimeout(r, 2000));
          setSpriteStateForChar(charId, prev => ({ ...prev, sayText: '' }));
          break;
        }
        case 'GROW': {
          const amount = block.times !== undefined ? block.times : 1;
          setSpriteStateForChar(charId, prev => ({ ...prev, scale: prev.scale + (amount * 0.15) }));
          break;
        }
        case 'SHRINK': {
          const amount = block.times !== undefined ? block.times : 1;
          setSpriteStateForChar(charId, prev => ({ ...prev, scale: Math.max(0.15, prev.scale - (amount * 0.15)) }));
          break;
        }
        case 'RESET_SIZE':
          setSpriteStateForChar(charId, prev => ({ ...prev, scale: 1.2 }));
          break;
        case 'HIDE':
          setSpriteStateForChar(charId, prev => ({ ...prev, visible: false }));
          break;
        case 'SHOW':
          setSpriteStateForChar(charId, prev => ({ ...prev, visible: true }));
          break;
        case 'POP': {
          const soundEffectId = block.text || 'pop';
          playSoundEffect(soundEffectId);
          await new Promise(r => setTimeout(r, 220));
          break;
        }
        case 'PLAY_RECORDED': {
          const recordingId = block.times !== undefined ? block.times : 1;
          const url = recordings[recordingId];
          if (url) {
            try {
              const audio = new Audio(url);
              await new Promise<void>((resolve) => {
                audio.onended = () => resolve();
                audio.onerror = () => resolve();
                audio.play().catch((err) => {
                  console.log('Error playing recording:', err);
                  resolve();
                });
              });
            } catch (err) {
              console.log('Audio error:', err);
            }
          }
          break;
        }
        case 'WAIT': {
          const tenths = block.times !== undefined ? block.times : 10;
          const totalWait = tenths * 100;
          const waitStep = 50;
          let waited = 0;
          while (waited < totalWait && !isCharStopped(charId)) {
            await new Promise(r => setTimeout(r, Math.min(waitStep, totalWait - waited)));
            waited += waitStep;
          }
          break;
        }
        case 'SET_SPEED': {
          const speed = block.times !== undefined ? block.times : 2;
          let newDelay = 100;
          if (speed === 1) {
            newDelay = 300; // Slow
          } else if (speed === 3) {
            newDelay = 50; // Fast
          } else {
            newDelay = 100; // Medium
          }
          setSpriteStateForChar(charId, prev => ({ ...prev, speedDelay: newDelay }));
          break;
        }
        case 'REPEAT':
          if (block.children && block.children.length > 0) {
            for (let i = 0; i < (block.times || 4); i++) {
              if (isCharStopped(charId)) break;
              await runBlocks(block.children, charId, isForever);
              if (isCharStopped(charId)) break;
            }
          }
          break;
        case 'REPEAT_FOREVER':
          if (block.children) {
            while (!isCharStopped(charId)) {
              if (block.children.length > 0) {
                await runBlocks(block.children, charId, true);
              } else {
                await new Promise(r => setTimeout(r, 50));
              }
            }
          }
          break;
        case 'STOP':
          stoppedCharactersRef.current.add(charId);
          await new Promise(r => setTimeout(r, delayMsRef.current));
          removeActiveBlockId(block.id);
          return;
        case 'SEND_MESSAGE': {
          const color = block.text || 'orange';
          broadcastMessage(color);
          break;
        }
        case 'END':
          return;
        case 'GOTO_PAGE': {
          const targetIndex = block.times !== undefined ? block.times : 2;
          const targetSceneIndex = targetIndex - 1;
          const targetScene = scenes[targetSceneIndex];
          if (targetScene) {
            autoPlayNextSceneRef.current = targetScene.id;
            shouldStopRef.current = true;
            stoppedCharactersRef.current.clear();
            setActiveSceneId(targetScene.id);
          }
          break;
        }
      }
      
      if (block.type !== 'REPEAT' && block.type !== 'REPEAT_FOREVER' && 
          block.type !== 'MOVE_RIGHT' && block.type !== 'MOVE_LEFT' && 
          block.type !== 'MOVE_UP' && block.type !== 'MOVE_DOWN' &&
          block.type !== 'TURN_RIGHT' && block.type !== 'TURN_LEFT' &&
          block.type !== 'GOTO_PAGE') {
        await new Promise(r => setTimeout(r, delayMsRef.current));
      }
      removeActiveBlockId(block.id);
    }
  };

  const runTracked = async (blocks: BlockInstance[], charId: string) => {
    if (blocks.length === 0) return;
    
    // Create a unique key for this stack for this character
    const stackId = `${charId}-${blocks[0].id}`;
    
    // If this specific stack is already running for this character, don't start it again
    if (runningStacksRef.current.has(stackId)) {
      return;
    }

    if (activeRunsCountRef.current === 0) {
      shouldStopRef.current = false;
      stoppedCharactersRef.current.clear();
    }
    stoppedCharactersRef.current.delete(charId);
    activeRunsCountRef.current++;
    runningStacksRef.current.add(stackId);
    setIsRunning(true);
    try {
      await runBlocks(blocks, charId);
    } finally {
      activeRunsCountRef.current--;
      runningStacksRef.current.delete(stackId);
      if (activeRunsCountRef.current <= 0) {
        activeRunsCountRef.current = 0;
        setIsRunning(false);
        setActiveBlockId(null);
      }
    }
  };

  const broadcastMessage = (color: string) => {
    if (shouldStopRef.current) return;
    const activeScene = scenes.find(s => s.id === activeSceneId) || scenes[0];
    const characterStacks = activeScene.characterStacks || {};
    
    characters.forEach(char => {
      const charStacks = characterStacks[char.id] || [];
      const getMsgStacks = charStacks.filter(s => {
        const first = s.blocks[0];
        return first && first.type === 'START_GET_MESSAGE' && (first.text || 'orange') === color;
      });
      
      getMsgStacks.forEach(s => {
        runTracked(s.blocks, char.id);
      });
    });
  };

  const handleSaveProject = async () => {
    const projectData = {
      format: "scratchjr-web",
      version: 1,
      scenes,
      activeSceneId,
      activeCharacterId
    };
    
    const blob = new Blob([JSON.stringify(projectData)], { type: "application/json" });
    // On browsers that support it, write to the file chosen by the user. This
    // avoids download security warnings for the custom .ljr extension.
    if (typeof (window as any).showSaveFilePicker === "function") {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: "project.ljr",
          types: [{ description: "Logiblox JR project", accept: { "application/json": [".ljr"] } }],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.warn("Could not save with the file picker; using a download instead.", error);
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "project.ljr";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Keep the object URL alive until the browser has started the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const handleLoadProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const projectData = JSON.parse(text);
        
        if (projectData.format === "scratchjr-web") {
          const loadedScenes = (projectData.scenes || []).map((s: any) => {
            let sceneTexts = s.texts;
            if (!sceneTexts && s.text) {
              sceneTexts = [{
                id: 'legacy-scene-title',
                text: s.text,
                color: s.textColor || '#000000',
                size: s.textSize || 'medium',
                x: s.textPosition?.x ?? 10.5,
                y: s.textPosition?.y ?? 13
              }];
            }
            return {
              ...s,
              texts: sceneTexts || []
            };
          });
          updateScenes(loadedScenes);
          setActiveSceneId(projectData.activeSceneId || 'scene-1');
          setActiveCharacterId(projectData.activeCharacterId || 'char-1');
        } else {
          alert("Unsupported file format. Please choose a file created with this application.");
        }
      } catch (err) {
        alert("Error loading the file.");
      }
    };
    reader.readAsText(file);
    
    event.target.value = '';
  };

  const playScene = () => {
    shouldStopRef.current = false;
    stoppedCharactersRef.current.clear();
    const activeScene = scenes.find(s => s.id === activeSceneId) || scenes[0];
    const characterStacks = activeScene.characterStacks || {};
    
    characters.forEach(char => {
      const charStacks = characterStacks[char.id] || [];
      const stacksToRun = charStacks.filter(s => s.blocks[0]?.type === 'START_FLAG');
      
      stacksToRun.forEach(s => {
        runTracked(s.blocks, char.id);
      });
    });
  };

  const stopScene = () => {
    shouldStopRef.current = true;
    stoppedCharactersRef.current.clear();
    setIsRunning(false);
    setActiveBlockId(null);
    activeRunsCountRef.current = 0;
    runningStacksRef.current.clear();
  };

  const handleCharacterClick = (charId: string) => {
    const activeScene = scenes.find(s => s.id === activeSceneId) || scenes[0];
    const characterStacks = activeScene.characterStacks || {};
    
    // Get the stacks of the character that was clicked (for START_TOUCH)
    const clickedCharStacks = characterStacks[charId] || [];
    const touchStacks = clickedCharStacks.filter(s => s.blocks[0]?.type === 'START_TOUCH');

    touchStacks.forEach(s => {
      runTracked(s.blocks, charId);
    });
  };


  return (
    <div className="h-screen max-h-screen bg-[#F4EFE6] flex flex-col font-sans select-none overflow-hidden">
      {/* Header */}
      <header className="bg-white h-16 flex items-center justify-between z-20 relative px-6 shadow-sm border-b border-[#e5dfd3]">
        {/* Left section: Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <img
            src={new URL('../logiblox-jr.svg', import.meta.url).href}
            alt="LogiBlox Jr"
            className="h-12 w-auto max-w-[204px] object-contain"
          />
        </div>
        
        {/* Center section: Green Flag, Stop | Separator | Add Text, Grid, Reset, Fullscreen, Background */}
        <div className="flex items-center justify-center gap-2 absolute left-1/2 -translate-x-1/2 z-10">
          {/* Green Flag & Stop */}
          <div className="flex items-center gap-1">
            <button 
              onClick={playScene}
              disabled={isRunning || stacks.length === 0}
              className="w-[56px] h-[56px] flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              title="Go (Green Flag)"
            >
              <img src={getAssetUrl("/UI/go.svg")} alt="Go" className="w-full h-full object-contain" />
            </button>
            <button 
              onClick={stopScene}
              disabled={!isRunning}
              className="w-[56px] h-[56px] flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              title="Stop"
            >
              <img src={getAssetUrl("/UI/stop1.svg")} alt="Stop" className="w-full h-full object-contain" />
            </button>
          </div>

          {/* Vertical Separator Line between STOP and ADD TEXT */}
          <div className="w-px h-8 bg-gray-300 mx-1 shrink-0"></div>

          {/* Add Text */}
          <button 
            onClick={() => {
              setEditingTextId(null);
              setIsTextModalOpen(true);
            }}
            className="w-[56px] h-[56px] flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
            title="Add Text"
          >
            <img src={getAssetUrl("/UI/addText.svg")} alt="Text" className="w-full h-full object-contain" />
          </button>

          {/* Grid */}
          <button 
            onClick={() => setShowGrid(!showGrid)}
            className={cn(
              "w-[56px] h-[56px] flex items-center justify-center transition-transform hover:scale-110",
              showGrid ? "scale-110 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]" : ""
            )}
            title="Show/Hide Grid"
          >
            <img src={getAssetUrl("/UI/gridOn.svg")} alt="Grid" className="w-full h-full object-contain" />
          </button>

          {/* Reset Stage (איפוס הבמה) */}
          <button 
            onClick={resetStage}
            className="w-[56px] h-[56px] flex items-center justify-center hover:scale-110 transition-transform"
            title="Reset Stage"
          >
            <img src={getAssetUrl("/UI/resetAll.svg")} alt="Reset" className="w-full h-full object-contain" />
          </button>

          {/* Full Screen */}
          <button 
            onClick={() => setIsPresentationMode(true)}
            className="w-[56px] h-[56px] flex items-center justify-center hover:scale-110 transition-transform"
            title="Full Screen"
          >
            <img src={getAssetUrl("/UI/fullOff2.svg")} alt="Full Screen" className="w-full h-full object-contain" />
          </button>

          {/* Background choice (Moved to the right of Full Screen) */}
          <div className="relative group flex items-center">
            <button 
              onClick={() => setIsBackgroundGalleryOpen(true)}
              className="w-[56px] h-[56px] flex items-center justify-center hover:scale-110 transition-transform"
              title="Choose Background"
            >
              <img src={getAssetUrl("/UI/scene1.svg")} alt="Background" className="w-full h-full object-contain" />
            </button>
            {activeScene?.background && (
              <button
                onClick={() => {
                  setEditingBackground({ 
                    name: 'Scene Background', 
                    url: activeScene.background || '', 
                    shapes: activeScene.backgroundShapes 
                  });
                  setIsPaintEditorOpen(true);
                }}
                className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 border-2 border-white hover:bg-amber-500 shadow-md rounded-full flex items-center justify-center z-20 transition-all hover:scale-110 cursor-pointer"
                title="Edit Current Background"
              >
                <Pencil className="w-3 h-3 text-white stroke-[2.5]" />
              </button>
            )}
          </div>

          {/* Vertical Separator Line between Full Screen and Save/Load */}
          <div className="w-px h-8 bg-gray-300 mx-1 shrink-0"></div>

          {/* Save & Load Project Icons */}
          <div className="flex items-center gap-1">
            <button 
              onClick={handleSaveProject}
              className="w-[56px] h-[56px] flex items-center justify-center hover:scale-110 transition-transform"
              title="Save Project"
            >
              <Save className="w-[36px] h-[36px] text-orange-500 stroke-[2.2]" />
            </button>
            
            <label 
              className="w-[56px] h-[56px] flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
              title="Load Project"
            >
              <FolderOpen className="w-[36px] h-[36px] text-green-600 stroke-[2.2]" />
              <input 
                type="file" 
                accept=".ljr,.sjr"
                onChange={handleLoadProject} 
                className="hidden" 
              />
            </label>
          </div>
        </div>
        
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-[1700px] mx-auto w-full p-4 gap-4 min-h-0 overflow-y-auto kid-scrollbar">
        
        {/* Top Half: Stage & Scenes */}
        <div className="flex-1 flex gap-6 min-h-[460px] shrink-0 overflow-hidden">
          {/* Left Sidebar: Characters */}
          <div className="w-64 bg-[#FBD5A5] rounded-[32px] flex flex-col items-center py-4 gap-3 border-4 border-[#F9C17D] shadow-inner shrink-0  overflow-hidden h-full">
            {/* Scrollable list of characters */}
            <div className="w-full kid-scrollbar flex flex-col gap-2 px-1 flex-1 overflow-y-auto items-center pb-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsGalleryOpen(true)}
                className="w-12 h-12 bg-[#7CB342] border-4 border-[#558B2F] rounded-2xl flex items-center justify-center shadow-lg text-white mt-1 shrink-0 sticky top-1 z-30 mb-2"
                title="Add Character"
              >
                <Plus className="w-7 h-7 stroke-[3]" />
              </motion.button>

              {characters.map((char) => {
                const isActive = char.id === activeCharacterId;
                return (
                  <div key={char.id} className="w-full px-3">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setActiveCharacterId(char.id)}
                      data-character-id={char.id}
                      className={cn(
                        "w-full h-24 rounded-3xl flex flex-col items-center justify-center relative transition-all duration-200 border-4 cursor-pointer character-drop-target",
                        isActive 
                          ? "bg-[#FDDE90] border-[#F57C00] shadow-lg scale-105 z-10" 
                          : "bg-white/40 border-transparent hover:bg-white/60"
                      )}
                    >
                      <div 
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          handleCharacterDragStart(e, char.id);
                        }}
                        className="transition-all duration-300 flex items-center justify-center mb-1 cursor-grab active:cursor-grabbing"
                      >
                        <img 
                          src={char.spriteUrl} 
                          alt={char.name} 
                          className={cn(
                            "transition-all duration-300 object-contain drop-shadow-sm pointer-events-none",
                            isActive ? "w-16 h-16" : "w-14 h-14"
                          )} 
                        />
                      </div>
                      <span className={cn(
                        "text-[10px] font-extrabold px-2 py-0.5 rounded-full truncate max-w-[90%] shadow-sm",
                        isActive ? "bg-white text-[#A07B1E]" : "bg-white/80 text-gray-700"
                      )}>
                        {char.name}
                      </span>
                      {isActive && (
                        <>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCharacterId(char.id);
                              setIsPaintEditorOpen(true);
                            }}
                            className="absolute top-1 right-1 w-8 h-8 bg-white border-2 border-black hover:bg-gray-100 shadow-sm rounded-full flex items-center justify-center z-20 transition-all"
                            title="Edit Character"
                          >
                            <Pencil className="w-4 h-4 text-black" />
                          </button>
                          
                          <button 
                            onClick={(e) => handleDuplicateCharacter(char.id, e)}
                            className="absolute bottom-1 right-1 w-8 h-8 bg-[#0288D1] border-2 border-white hover:bg-[#0277BD] shadow-md rounded-full flex items-center justify-center z-20 transition-all text-white"
                            title="Duplicate Character (with scripts)"
                          >
                            <Copy className="w-4 h-4 text-white stroke-[2.5]" />
                          </button>

                          {characters.length > 1 && (
                            <button 
                              onPointerDown={(e) => handleCharDeletePointerDown(e, char.id)}
                              onPointerUp={handleCharDeletePointerUp}
                              onPointerLeave={handleCharDeletePointerUp}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (armedDeleteCharId === char.id) {
                                  handleDeleteCharacter(char.id, e);
                                  setArmedDeleteCharId(null);
                                }
                              }}
                              className={cn(
                                "absolute top-1 left-1 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm z-20",
                                armedDeleteCharId === char.id 
                                  ? "bg-green-500 scale-110 shadow-[0_0_10px_rgba(34,197,94,0.6)]" 
                                  : "bg-red-500/80 hover:bg-red-500"
                              )}
                              title={armedDeleteCharId === char.id ? "Click to confirm delete" : "Hold to unlock delete"}
                            >
                              <Trash2 className={cn("w-4 h-4 text-white transition-transform", armedDeleteCharId === char.id && "scale-110")} />
                            </button>
                          )}
                        </>
                      )}
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>

          <Stage 
            key={activeSceneId}
            characters={characters} 
            activeCharacterId={activeCharacterId} 
            activeSceneId={activeSceneId}
            spriteStates={spriteStates} 
            showGrid={showGrid}
            background={activeScene?.background}
            texts={currentSceneTexts}
            sceneTitle={activeScene?.text}
            sceneTitleColor={activeScene?.textColor}
            sceneTitleSize={activeScene?.textSize}
            sceneTitlePosition={activeScene?.textPosition}
            onDeleteCharacter={(charId) => {
              if (characters.length > 1) {
                handleDeleteCharacter(charId);
              }
            }}
            onDuplicateCharacter={(charId) => handleDuplicateCharacter(charId)}
            onTextClick={() => {
              if (currentSceneTexts.length > 0) {
                handleEditText(currentSceneTexts[0].id);
              } else {
                setEditingTextId(null);
                setIsTextModalOpen(true);
              }
            }}
            onEditText={handleEditText}
            onDeleteText={handleDeleteText}
            onUpdateSceneTextPosition={handleUpdateSceneTextPosition}
            onUpdateTextPosition={(x, y) => {
              if (currentSceneTexts.length > 0) {
                handleUpdateSceneTextPosition(currentSceneTexts[0].id, x, y);
              }
            }}
            onSelectCharacter={(charId) => setActiveCharacterId(charId)}
            onCharacterClick={(charId) => handleCharacterClick(charId)}
            onUpdateCharacterPosition={(charId, x, y) => {
              setSpriteStates(prev => {
                const current = prev[charId] || INITIAL_SPRITE_STATE;
                const isManualDrag = !isRunning;
                return {
                  ...prev,
                  [charId]: {
                    ...current,
                    x,
                    y,
                    homeX: isManualDrag ? x : current.homeX,
                    homeY: isManualDrag ? y : current.homeY
                  }
                };
              });
            }}
          />

          {/* Right Sidebar: Scenes */}
          <div className="w-44 bg-[#FBD5A5] rounded-[32px] flex flex-col items-center py-4 gap-3 border-4 border-[#F9C17D] shadow-inner shrink-0  overflow-hidden h-full">
            {/* Scrollable list of scenes */}
            <div className="w-full kid-scrollbar flex flex-col items-center gap-3 px-1 pb-4 flex-1 overflow-y-auto">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleAddScene}
                className="w-14 h-14 bg-[#7CB342] border-4 border-[#558B2F] rounded-2xl flex items-center justify-center shadow-lg text-white shrink-0 mt-1 mb-2 sticky top-1 z-30"
                title="Add Scene"
              >
                <Plus className="w-8 h-8 stroke-[3]" />
              </motion.button>

              {scenes.map((scene, index) => {
                const isActive = scene.id === activeSceneId;
                return (
                  <div key={scene.id} className="w-full px-2">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setActiveSceneId(scene.id)}
                      data-scene-id={scene.id}
                      className={cn(
                        "w-full h-24 rounded-3xl flex flex-col items-center justify-center relative transition-all duration-200 border-4 overflow-hidden cursor-pointer scene-drop-target",
                        isActive 
                          ? "bg-[#FDDE90] border-[#F57C00] shadow-lg scale-105 z-10" 
                          : "bg-white/40 border-transparent hover:bg-white/60"
                      )}
                    >
                      <div className="w-full h-full bg-white flex items-center justify-center p-1">
                        <div className="w-full h-full rounded-xl bg-sky-100 flex items-center justify-center relative overflow-hidden">
                          <SceneThumbnail 
                            scene={scene} 
                            sceneNumber={index + 1} 
                            className="w-full h-full border-none shadow-none rounded-xl"
                            size="large"
                          />
                          {isActive && scenes.length > 1 && (
                            <button
                              onPointerDown={(e) => handleSceneDeletePointerDown(e, scene.id)}
                              onPointerUp={handleSceneDeletePointerUp}
                              onPointerLeave={handleSceneDeletePointerUp}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (armedDeleteSceneId === scene.id) {
                                  handleDeleteScene(scene.id);
                                  setArmedDeleteSceneId(null);
                                }
                              }}
                              className={cn(
                                "absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-sm z-20",
                                armedDeleteSceneId === scene.id 
                                  ? "bg-green-500 scale-110 shadow-[0_0_8px_rgba(34,197,94,0.6)]" 
                                  : "bg-red-500/80 hover:bg-red-500"
                              )}
                              title={armedDeleteSceneId === scene.id ? "Click to confirm delete" : "Hold to unlock delete"}
                            >
                              <Trash2 className={cn("w-3 h-3 text-white transition-transform", armedDeleteSceneId === scene.id && "scale-110")} />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Half: Coding Area */}
        <div className="flex flex-col bg-[#FDF2E3] rounded-[40px] shadow-xl border-4 border-[#F9C17D] overflow-hidden h-[380px] sm:h-[410px] md:h-[440px] shrink-0 min-h-0 relative">
          <Palette 
            onDragStart={handlePaletteDragStart} 
            onRecordClick={() => setIsRecordModalOpen(true)}
            onDeleteRecording={handleDeleteRecording}
            recordings={recordings}
          />
          
          <div className="flex-1 p-2 md:p-3 flex flex-col gap-1.5 min-h-0 relative">
            <div className="flex justify-between items-center px-3 py-1 border-b border-[#F9C17D]/30 mb-1">
              <h2 className="text-[#8D6E63] font-black uppercase tracking-wider text-[12px]">YOUR CODE</h2>
              <div className="flex items-center gap-2.5">
                <button 
                  onClick={handleUndo}
                  disabled={undoHistory.length === 0}
                  className="text-[#8D6E63] hover:text-orange-600 disabled:opacity-30 disabled:hover:text-[#8D6E63] disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-[12px] font-black uppercase cursor-pointer"
                  title="Undo"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  UNDO
                </button>
                <button 
                  onClick={handleRedo}
                  disabled={redoHistory.length === 0}
                  className="text-[#8D6E63] hover:text-orange-600 disabled:opacity-30 disabled:hover:text-[#8D6E63] disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-[12px] font-black uppercase cursor-pointer"
                  title="Redo"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                  REDO
                </button>
                <div className="w-px h-3.5 bg-[#8D6E63]/30 mx-0.5"></div>
                <button 
                  onClick={clearWorkspace}
                  className="text-[#8D6E63] hover:text-red-500 transition-colors flex items-center gap-1.5 text-[12px] font-black uppercase cursor-pointer"
                  title="Clear workspace"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  CLEAR
                </button>
              </div>
            </div>
            
            <div className="flex-1 relative min-h-0">
              {/* Active Character Watermark/Preview */}
              {(() => {
                const activeChar = characters.find(c => c.id === activeCharacterId);
                if (!activeChar) return null;
                return (
                  <div className="absolute top-4 left-4 w-28 h-28 pointer-events-none z-10 opacity-30">
                    <img 
                      src={activeChar.spriteUrl} 
                      alt="" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                );
              })()}

              <Workspace 
                workspaceRef={workspaceRef}
                stacks={stacks} 
                activeBlockId={activeBlockId}
                activeBlockIds={activeBlockIds}
                onTimesChange={handleTimesChange}
                onTextChange={handleTextChange}
                onOpenKeypad={handleOpenKeypad}
                onDelete={handleDeleteBlock}
                onDragStart={handleWorkspaceDragStart}
                characters={characters}
                scenes={scenes}
              />
            </div>
          </div>
        </div>
      </main>

      <DragOverlayView dragState={dragState} scenes={scenes} characters={characters} />
      
      <SpriteGallery 
        isOpen={isGalleryOpen} 
        onClose={() => setIsGalleryOpen(false)} 
        onSelect={handleSelectSprite} 
        onPaintNew={() => setIsPaintEditorOpen(true)}
      />

      <PaintEditor
        isOpen={isPaintEditorOpen}
        isBackground={!!editingBackground}
        onClose={() => {
          setIsPaintEditorOpen(false);
          setEditingCharacterId(null);
          setEditingBackground(null);
        }}
        initialName={
          editingBackground
            ? editingBackground.name
            : (editingCharacterId ? characters.find(c => c.id === editingCharacterId)?.name : undefined)
        }
        initialShapes={
          editingBackground
            ? (editingBackground.shapes || activeScene?.backgroundShapes)
            : (editingCharacterId ? characters.find(c => c.id === editingCharacterId)?.shapes : undefined)
        }
        initialSpriteUrl={
          editingBackground
            ? editingBackground.url
            : (editingCharacterId ? characters.find(c => c.id === editingCharacterId)?.spriteUrl : undefined)
        }
        onSave={(name, dataUrl, shapes) => {
          if (editingBackground) {
            handleSelectBackground({ name, url: dataUrl, shapes });
            setEditingBackground(null);
          } else if (editingCharacterId) {
            // Edit existing character
            setCharacters(prev => prev.map(c => c.id === editingCharacterId ? { ...c, name, spriteUrl: dataUrl, shapes } : c));
            setEditingCharacterId(null);
          } else {
            // Create new character
            const newCharId = `char-${Date.now()}`;
            setCharacters(prev => [...prev, { id: newCharId, name, spriteUrl: dataUrl, shapes }]);
            setSpriteStates(prev => ({
              ...prev,
              [newCharId]: INITIAL_SPRITE_STATE
            }));
            updateScenes(prev => prev.map(s => {
              if (s.id === activeSceneId) {
                return {
                  ...s,
                  characterStacks: {
                    ...(s.characterStacks || {}),
                    [newCharId]: []
                  }
                };
              }
              return s;
            }));
            setActiveCharacterId(newCharId);
          }
          setIsPaintEditorOpen(false);
        }}
      />

      <BackgroundGallery
        isOpen={isBackgroundGalleryOpen}
        onClose={() => setIsBackgroundGalleryOpen(false)}
        onSelect={handleSelectBackground}
        onPaintNew={() => {
          setIsBackgroundGalleryOpen(false);
          setEditingBackground({ name: 'My Background', url: '' });
          setIsPaintEditorOpen(true);
        }}
        onEditBackground={(bg) => {
          setIsBackgroundGalleryOpen(false);
          setEditingBackground(bg);
          setIsPaintEditorOpen(true);
        }}
      />

      <KidKeypad
        isOpen={keypadConfig.isOpen}
        mode={keypadConfig.mode}
        title={keypadConfig.title}
        initialValue={keypadConfig.initialValue}
        anchorRect={keypadConfig.anchorRect}
        onClose={() => setKeypadConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={keypadConfig.onConfirm}
        characters={characters}
        activeCharacterId={activeCharacterId}
        scenes={scenes}
      />

      <TextEditorModal
        isOpen={isTextModalOpen}
        initialValue={editingTextId ? (currentSceneTexts.find(t => t.id === editingTextId)?.text || '') : ''}
        initialColor={editingTextId ? (currentSceneTexts.find(t => t.id === editingTextId)?.color || '#000000') : '#000000'}
        initialSize={editingTextId ? (currentSceneTexts.find(t => t.id === editingTextId)?.size || 'medium') : 'medium'}
        onClose={() => {
          setIsTextModalOpen(false);
          setEditingTextId(null);
        }}
        onSave={handleSaveTextModal}
        onDelete={editingTextId ? () => handleDeleteText(editingTextId) : undefined}
      />

      <RecordModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        recordings={recordings}
        onDeleteRecording={handleDeleteRecording}
        onSave={(audioUrl) => {
          const nextId = Object.keys(recordings).length + 1;
          setRecordings(prev => ({ ...prev, [nextId]: audioUrl }));
          setIsRecordModalOpen(false);
        }}
      />

      {isPresentationMode && (
        <div className="fixed inset-0 bg-[#F4EFE6] z-[9999] flex flex-col select-none overflow-hidden">
          {/* Top Control Bar */}
          <div className="h-[88px] w-full flex items-center justify-between bg-white/80 backdrop-blur-md px-6 md:px-12 border-b-2 border-white/50 shrink-0 shadow-sm z-10">
            {/* Play/Stop Controls */}
            <div className="flex items-center gap-6">
              <button 
                onClick={playScene}
                disabled={isRunning || stacks.length === 0}
                className="hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed drop-shadow-md"
                title="Go"
              >
                <img src={getAssetUrl("/UI/go.svg")} alt="Go" className="w-[64px] h-[64px] object-contain" />
              </button>
              
              <button 
                onClick={stopScene}
                disabled={!isRunning}
                className="hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed drop-shadow-md"
                title="Stop"
              >
                <img src={getAssetUrl("/UI/stop1.svg")} alt="Stop" className="w-[64px] h-[64px] object-contain" />
              </button>

              <button 
                onClick={resetStage}
                className="hover:scale-110 transition-transform drop-shadow-md"
                title="Reset Stage"
              >
                <img src={getAssetUrl("/UI/resetAll.svg")} alt="Reset" className="w-[64px] h-[64px] object-contain" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-md">
                <Rocket className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight hidden sm:block">Presentation Mode</h2>
            </div>

            {/* Exit Full Screen */}
            <button 
              onClick={() => {
                stopScene();
                setIsPresentationMode(false);
              }}
              className="hover:scale-110 transition-transform drop-shadow-md"
              title="Exit Full Screen"
            >
              <img src={getAssetUrl("/UI/fullOff2.svg")} alt="Exit Full Screen" className="w-[64px] h-[64px] object-contain" />
            </button>
          </div>

          {/* Full Screen Stage Container */}
          <div className="flex-1 w-full relative overflow-hidden p-2 sm:p-6 pb-8 flex flex-col">
            <Stage 
              key={activeSceneId}
              characters={characters} 
              activeCharacterId={activeCharacterId} 
              activeSceneId={activeSceneId}
              spriteStates={spriteStates} 
              showGrid={false}
              background={activeScene?.background}
              texts={currentSceneTexts}
              sceneTitle={activeScene?.text}
              sceneTitleColor={activeScene?.textColor}
              sceneTitleSize={activeScene?.textSize}
              sceneTitlePosition={activeScene?.textPosition}
              disableDragging={true}
              onSelectCharacter={(charId) => setActiveCharacterId(charId)}
              onCharacterClick={(charId) => handleCharacterClick(charId)}
            />
          </div>
        </div>
      )}

      {/* Mobile Warning Overlay */}
      {showMobileWarning && (
        <div className="md:hidden fixed inset-0 bg-white/95 backdrop-blur-sm z-[99999] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mb-6">
            <Monitor className="w-12 h-12 text-amber-600" />
          </div>
          <h2 className="text-3xl font-black text-slate-800 mb-4">Desktop Recommended</h2>
          <p className="text-xl text-slate-600 mb-8 max-w-sm">
            This version is optimized for desktop computers and some tablets.
          </p>
          <button 
            onClick={() => setShowMobileWarning(false)}
            className="px-8 py-4 bg-indigo-500 text-white rounded-2xl font-bold text-xl hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/30 active:scale-95"
          >
            Continue anyway
          </button>
        </div>
      )}

    </div>
  );
}
