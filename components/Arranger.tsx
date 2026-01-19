import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ProjectState, Clip, ToolMode, Track } from '../types';
import Waveform from './Waveform';
import { audio } from '../services/audio';
import { Scissors, MousePointer, Trash2, Repeat, ZoomIn, ZoomOut, GripVertical, Plus, Grid, Activity } from 'lucide-react';

interface ArrangerProps {
  project: ProjectState;
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>;
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onSplit: (clipId: string, time: number) => void;
  zoom: number;
  setZoom: (z: number) => void;
  selectedTrackId: string | null;
  onSelectTrack: (id: string) => void;
  selectedClipId: string | null;
  onSelectClip: (id: string | null) => void;
}

const TRACK_HEIGHT = 96; // 6rem / h-24

// Snap options in terms of BEATS
// Assuming 4/4 signature for simplicity
const SNAP_OPTIONS = [
    { label: 'Off', value: 0 },
    { label: '1/16', value: 0.25 }, // 1/16th note is 0.25 beats
    { label: '1/8', value: 0.5 },   // 1/8th note is 0.5 beats
    { label: '1/4', value: 1.0 },   // Quarter note is 1 beat
    { label: 'Bar', value: 4.0 },   // Bar is 4 beats
];

const Arranger: React.FC<ArrangerProps> = ({ 
    project, 
    setProject, 
    currentTime, 
    isPlaying, 
    onSeek, 
    onSplit,
    zoom,
    setZoom,
    selectedTrackId,
    onSelectTrack,
    selectedClipId,
    onSelectClip
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trackHeaderContainerRef = useRef<HTMLDivElement>(null);
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<ToolMode>(ToolMode.POINTER);
  const [snapBeatValue, setSnapBeatValue] = useState(1.0); // Default to 1/4 note snap
  
  // Interaction State
  const [dragState, setDragState] = useState<{
      clipId: string;
      mode: 'MOVE' | 'TRIM_START' | 'TRIM_END';
      startX: number;
      startY: number;
      original: Clip;
  } | null