import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { StoryNode } from './StoryNode';
import { StoryEdge } from './StoryEdge';
import type { Scene } from '../VideoReel';

export interface GraphEntity {
  id: string;
  name: string;
  type: string;
}

export interface GraphEvent {
  sceneIndex: number;
  action: 'introduce' | 'remove' | 'connect' | 'disconnect' | 'highlight';
  entityId?: string;
  fromEntityId?: string;
  toEntityId?: string;
  label?: string;
  sentiment?: string;
  x?: number;
  y?: number;
}

export interface StoryGraphCanvasProps {
  entities: GraphEntity[];
  graphEvents: GraphEvent[];
  scenes: Scene[];
  graphSettings?: {
    overlayOnBroll?: boolean;
    brollOpacity?: number;
    glowIntensity?: number;
  } | null;
}

export const StoryGraphCanvas: React.FC<StoryGraphCanvasProps> = ({
  entities,
  graphEvents,
  scenes,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();


  // 1. Calculate frame ranges for each scene
  const sceneRanges = useMemo(() => {
    const ranges: { startFrame: number; endFrame: number }[] = [];
    scenes.forEach((scene) => {
      ranges.push({
        startFrame: Math.round(scene.start_time * fps),
        endFrame: Math.round(scene.end_time * fps),
      });
    });
    return ranges;
  }, [scenes, fps]);

  // Find the active scene index for the current frame, clamping to the most recently ended scene during gaps
  const currentSceneIndex = useMemo(() => {
    const idx = sceneRanges.findIndex(
      (r) => frame >= r.startFrame && frame < r.endFrame
    );
    if (idx !== -1) return idx;
    
    // Find the scene that ended most recently before the current frame
    for (let i = sceneRanges.length - 1; i >= 0; i--) {
      if (frame >= sceneRanges[i].endFrame) {
        return i;
      }
    }
    return 0;
  }, [sceneRanges, frame]);

  // 2. Compute the active graph state (nodes & connections) for every scene index
  const graphStatesPerScene = useMemo(() => {
    const states: {
      activeNodes: Map<string, { x: number; y: number; entryFrame: number; active: boolean }>;
      activeEdges: Map<string, { from: string; to: string; label?: string; sentiment?: string; entryFrame: number; active: boolean }>;
    }[] = [];

    let currentNodes = new Map<string, { x: number; y: number; entryFrame: number; active: boolean }>();
    let currentEdges = new Map<string, { from: string; to: string; label?: string; sentiment?: string; entryFrame: number; active: boolean }>();

    for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
      const sRange = sceneRanges[sIdx];
      const startFrame = sRange ? sRange.startFrame : 0;

      // Copy previous state to maintain continuity
      currentNodes = new Map(currentNodes);
      currentEdges = new Map(currentEdges);

      // Reset all highlights for this scene initially
      for (const [nid, node] of currentNodes.entries()) {
        currentNodes.set(nid, { ...node, active: false });
      }
      for (const [eid, edge] of currentEdges.entries()) {
        currentEdges.set(eid, { ...edge, active: false });
      }

      // Process all events belonging to this scene
      const eventsForScene = graphEvents.filter((e) => e.sceneIndex === sIdx);

      // Auto-tidy rule: If there are 'introduce' events in this scene, 
      // prune old nodes that are not referenced in the current scene's events.
      const hasIntroductions = eventsForScene.some((e) => e.action === 'introduce');
      if (hasIntroductions) {
        const referencedEntities = new Set<string>();
        eventsForScene.forEach((e) => {
          if (e.entityId) referencedEntities.add(e.entityId);
          if (e.fromEntityId) referencedEntities.add(e.fromEntityId);
          if (e.toEntityId) referencedEntities.add(e.toEntityId);
        });

        for (const nid of currentNodes.keys()) {
          if (!referencedEntities.has(nid)) {
            currentNodes.delete(nid);
            // Clean up dangling edges
            for (const [eid, edge] of currentEdges.entries()) {
              if (edge.from === nid || edge.to === nid) {
                currentEdges.delete(eid);
              }
            }
          }
        }
      }

      eventsForScene.forEach((event) => {
        if (event.action === 'introduce' && event.entityId) {
          currentNodes.set(event.entityId, {
            x: event.x ?? 50,
            y: event.y ?? 50,
            entryFrame: startFrame,
            active: false,
          });
        } else if (event.action === 'remove' && event.entityId) {
          currentNodes.delete(event.entityId);
          // Clean up dangling edges
          for (const [eid, edge] of currentEdges.entries()) {
            if (edge.from === event.entityId || edge.to === event.entityId) {
              currentEdges.delete(eid);
            }
          }
        } else if (event.action === 'connect' && event.fromEntityId && event.toEntityId) {
          const edgeId = `${event.fromEntityId}-${event.toEntityId}`;
          currentEdges.set(edgeId, {
            from: event.fromEntityId,
            to: event.toEntityId,
            label: event.label,
            sentiment: event.sentiment,
            entryFrame: startFrame,
            active: false,
          });
        } else if (event.action === 'disconnect' && event.fromEntityId && event.toEntityId) {
          const edgeId = `${event.fromEntityId}-${event.toEntityId}`;
          currentEdges.delete(edgeId);
        } else if (event.action === 'highlight' && event.entityId) {
          const node = currentNodes.get(event.entityId);
          if (node) {
            currentNodes.set(event.entityId, { ...node, active: true });
          }
          // Also highlight any connections linked to this node
          for (const [eid, edge] of currentEdges.entries()) {
            if (edge.from === event.entityId || edge.to === event.entityId) {
              currentEdges.set(eid, { ...edge, active: true });
            }
          }
        }
      });

      // Ring Layout Fallback: if nodes don't have distinct positions, space them out
      const nodesWithoutPos = Array.from(currentNodes.entries()).filter(
        ([_, n]) => n.x === 50 && n.y === 50
      );
      if (nodesWithoutPos.length > 0) {
        const totalNodes = currentNodes.size;
        Array.from(currentNodes.entries()).forEach(([nid, node], idx) => {
          // If it was left at default (50, 50), assign a circle coordinate
          if (node.x === 50 && node.y === 50) {
            const angle = (idx * 2 * Math.PI) / totalNodes;
            currentNodes.set(nid, {
              ...node,
              x: Math.round(50 + 28 * Math.cos(angle)),
              y: Math.round(45 + 22 * Math.sin(angle)),
            });
          }
        });
      }

      states.push({
        activeNodes: new Map(currentNodes),
        activeEdges: new Map(currentEdges),
      });
    }

    return states;
  }, [scenes, sceneRanges, graphEvents]);

  // Extract the specific nodes & edges for the current frame
  const currentGraphState = useMemo(() => {
    return graphStatesPerScene[currentSceneIndex] || { activeNodes: new Map(), activeEdges: new Map() };
  }, [graphStatesPerScene, currentSceneIndex]);

  // 3. Compute camera parameters (Centroid & Zoom) for each scene
  const cameraStatesPerScene = useMemo(() => {
    const isVertical = width < height;
    return graphStatesPerScene.map((state) => {
      const allNodes = Array.from(state.activeNodes.values());
      if (allNodes.length === 0) {
        return { tx: 0, ty: 0, scale: 1.0 };
      }

      // Filter to highlighted nodes in the scene for focused zoom
      const highlightedNodes = allNodes.filter((n) => n.active);
      const targetNodes = highlightedNodes.length > 0 ? highlightedNodes : allNodes;

      const xs = targetNodes.map((n) => n.x);
      const ys = targetNodes.map((n) => n.y);

      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const widthPct = maxX - minX;
      const heightPct = maxY - minY;

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      // Center (50%, 45%) in our canvas coordinate
      const tx = 50 - centerX;
      const ty = 45 - centerY;

      // Scale zoom factor based on bounding box
      const padding = highlightedNodes.length > 0 ? 15 : 25; // tighter padding when focused
      const boxSize = Math.max(widthPct, heightPct) + padding;
      
      let scale = highlightedNodes.length > 0
        ? Math.min(2.5, Math.max(1.5, 95 / boxSize))
        : Math.min(1.8, Math.max(0.8, 90 / boxSize));

      // SAFE BOUNDS CAPPING: Ensure target nodes do not leave the canvas viewport
      let maxSafeScale = 2.5;
      if (centerX > minX) maxSafeScale = Math.min(maxSafeScale, 42 / (centerX - minX));
      if (maxX > centerX) maxSafeScale = Math.min(maxSafeScale, 42 / (maxX - centerX));
      if (centerY > minY) maxSafeScale = Math.min(maxSafeScale, 37 / (centerY - minY));
      if (maxY > centerY) maxSafeScale = Math.min(maxSafeScale, 47 / (maxY - centerY));

      scale = Math.min(scale, maxSafeScale);

      // Aggressive crop for vertical viewports (Shorts/Reels 9:16)
      if (isVertical) {
        scale = scale * 1.25;
        scale = Math.min(3.0, scale); // prevent excessive zooming on isolated nodes
      }

      return { tx, ty, scale };
    });
  }, [graphStatesPerScene, width, height]);

  // Determine if the current scene has a connect event and we are in the focus/pan phases
  const connectionFocus = useMemo(() => {
    const activeSceneRange = sceneRanges[currentSceneIndex];
    if (!activeSceneRange) return { active: false, involvedNodes: new Set<string>(), involvedEdgeIds: new Set<string>(), focusProgress: 1.0 };

    const eventsForScene = graphEvents.filter((e) => e.sceneIndex === currentSceneIndex);
    const connectEvents = eventsForScene.filter((e) => e.action === 'connect');
    if (connectEvents.length === 0) return { active: false, involvedNodes: new Set<string>(), involvedEdgeIds: new Set<string>(), focusProgress: 1.0 };

    const relativeFrame = frame - activeSceneRange.startFrame;
    const duration = Math.max(1, activeSceneRange.endFrame - activeSceneRange.startFrame);
    const t = relativeFrame / duration;

    let focusProgress = 1.0;
    if (t < 0.30) {
      focusProgress = 0.0;
    } else if (t >= 0.30 && t < 0.40) {
      focusProgress = (t - 0.30) / 0.10;
    }

    const involvedNodes = new Set<string>();
    const involvedEdgeIds = new Set<string>();
    connectEvents.forEach((ev) => {
      if (ev.fromEntityId) involvedNodes.add(ev.fromEntityId);
      if (ev.toEntityId) involvedNodes.add(ev.toEntityId);
      involvedEdgeIds.add(`${ev.fromEntityId}-${ev.toEntityId}`);
    });

    return {
      active: true,
      involvedNodes,
      involvedEdgeIds,
      focusProgress,
    };
  }, [currentSceneIndex, sceneRanges, graphEvents, frame]);

  // Smooth camera transitions using Remotion spring or cinematic tracking
  const camera = useMemo(() => {
    const activeScene = scenes[currentSceneIndex];
    const activeSceneRange = sceneRanges[currentSceneIndex];
    
    if (!activeScene || !activeSceneRange) {
      return { tx: 0, ty: 0, scale: 1.0, activeEdgeId: null, drawProgress: 1.0 };
    }

    const relativeFrame = frame - activeSceneRange.startFrame;
    const duration = Math.max(1, activeSceneRange.endFrame - activeSceneRange.startFrame);
    const t = relativeFrame / duration;

    // Check if there are connect events in the current scene
    const eventsForScene = graphEvents.filter((e) => e.sceneIndex === currentSceneIndex);
    const connectEvents = eventsForScene.filter((e) => e.action === 'connect');

    if (connectEvents.length > 0) {
      const defaultCam = cameraStatesPerScene[currentSceneIndex] || { scale: 1.5, tx: 0, ty: 0 };
      const prevCam = currentSceneIndex > 0 
        ? cameraStatesPerScene[currentSceneIndex - 1] 
        : { tx: 0, ty: 0, scale: 1.0 };

      // Find common center focus node
      let focusNodeId = '';
      const counts = new Map<string, number>();
      connectEvents.forEach((ev) => {
        if (ev.fromEntityId) counts.set(ev.fromEntityId, (counts.get(ev.fromEntityId) || 0) + 1);
        if (ev.toEntityId) counts.set(ev.toEntityId, (counts.get(ev.toEntityId) || 0) + 1);
      });
      let maxCount = 0;
      for (const [nid, count] of counts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          focusNodeId = nid;
        }
      }
      if (!focusNodeId) {
        focusNodeId = connectEvents[0].toEntityId || connectEvents[0].fromEntityId || '';
      }

      const focusNode = currentGraphState.activeNodes.get(focusNodeId);

      if (focusNode) {
        if (connectEvents.length > 1) {
          // MULTIPLE CONNECTIONS TRANSITION: Focus on target/center, zoom out and draw simultaneously
          const edgeId = 'multiple';

          if (t < 0.10) {
            // Phase 1: Focus on the center node (0% to 10%)
            const phaseProgress = t / 0.10;
            const ease = Math.sin(phaseProgress * Math.PI / 2); // ease out
            
            const targetTx = 50 - focusNode.x;
            const targetTy = 45 - focusNode.y;
            
            const tx = prevCam.tx + (targetTx - prevCam.tx) * ease;
            const ty = prevCam.ty + (targetTy - prevCam.ty) * ease;
            const s = prevCam.scale + (2.4 - prevCam.scale) * ease;
            
            return { tx, ty, scale: s, activeEdgeId: edgeId, drawProgress: 0.0 };
          } else if (t >= 0.10 && t < 0.40) {
            // Phase 2 & 3: Zoom Out and draw lines simultaneously (10% to 40%)
            const phaseProgress = (t - 0.10) / 0.30;
            const ease = Math.sin(phaseProgress * Math.PI / 2); // ease out
            
            const startTx = 50 - focusNode.x;
            const startTy = 45 - focusNode.y;
            
            const tx = startTx + (defaultCam.tx - startTx) * ease;
            const ty = startTy + (defaultCam.ty - startTy) * ease;
            const s = 2.4 + (defaultCam.scale - 2.4) * ease;
            
            return { tx, ty, scale: s, activeEdgeId: edgeId, drawProgress: ease };
          } else {
            // Phase 4: Full view (40% to 100%)
            return { 
              tx: defaultCam.tx, 
              ty: defaultCam.ty, 
              scale: defaultCam.scale, 
              activeEdgeId: edgeId, 
              drawProgress: 1.0 
            };
          }
        } else {
          // SINGLE CONNECTION TRANSITION: Focus A -> Pan to B -> Zoom Out
          const connectEvent = connectEvents[0];
          const fromNode = currentGraphState.activeNodes.get(connectEvent.fromEntityId || '');
          const toNode = currentGraphState.activeNodes.get(connectEvent.toEntityId || '');

          if (fromNode && toNode) {
            const edgeId = `${connectEvent.fromEntityId}-${connectEvent.toEntityId}`;

            if (t < 0.10) {
              // Phase 1: Focus on A (0% to 10%)
              const phaseProgress = t / 0.10;
              const ease = Math.sin(phaseProgress * Math.PI / 2); // ease out
              
              const targetTx = 50 - fromNode.x;
              const targetTy = 45 - fromNode.y;
              
              const tx = prevCam.tx + (targetTx - prevCam.tx) * ease;
              const ty = prevCam.ty + (targetTy - prevCam.ty) * ease;
              const s = prevCam.scale + (2.4 - prevCam.scale) * ease;
              
              return { tx, ty, scale: s, activeEdgeId: edgeId, drawProgress: 0.0 };
            } else if (t >= 0.10 && t < 0.30) {
              // Phase 2: Pan from A to B and draw line (10% to 30%)
              const phaseProgress = (t - 0.10) / 0.20;
              const ease = Math.sin(phaseProgress * Math.PI - Math.PI / 2) * 0.5 + 0.5; // ease in out
              
              const cx = fromNode.x + (toNode.x - fromNode.x) * ease;
              const cy = fromNode.y + (toNode.y - fromNode.y) * ease;
              
              const tx = 50 - cx;
              const ty = 45 - cy;
              return { tx, ty, scale: 2.4, activeEdgeId: edgeId, drawProgress: ease };
            } else if (t >= 0.30 && t < 0.40) {
              // Phase 3: Zoom Out to show full picture (30% to 40%)
              const phaseProgress = (t - 0.30) / 0.10;
              const ease = Math.sin(phaseProgress * Math.PI / 2); // ease out
              
              const startTx = 50 - toNode.x;
              const startTy = 45 - toNode.y;
              
              const tx = startTx + (defaultCam.tx - startTx) * ease;
              const ty = startTy + (defaultCam.ty - startTy) * ease;
              const s = 2.4 + (defaultCam.scale - 2.4) * ease;
              
              return { tx, ty, scale: s, activeEdgeId: edgeId, drawProgress: 1.0 };
            } else {
              // Phase 4: Full view (40% to 100%)
              return { 
                tx: defaultCam.tx, 
                ty: defaultCam.ty, 
                scale: defaultCam.scale, 
                activeEdgeId: edgeId, 
                drawProgress: 1.0 
              };
            }
          }
        }
      }
    }

    // Default: smooth transition between scene camera states using spring
    const currentCam = cameraStatesPerScene[currentSceneIndex] || { tx: 0, ty: 0, scale: 1.0 };
    const prevCam = currentSceneIndex > 0 
      ? cameraStatesPerScene[currentSceneIndex - 1] 
      : { tx: 0, ty: 0, scale: 1.0 };

    const transitionFrame = frame - activeSceneRange.startFrame;
    const mix = spring({
      frame: transitionFrame,
      fps,
      config: {
        damping: 18,
        mass: 0.9,
        stiffness: 60,
      },
    });

    const tx = prevCam.tx + (currentCam.tx - prevCam.tx) * mix;
    const ty = prevCam.ty + (currentCam.ty - prevCam.ty) * mix;
    const scale = prevCam.scale + (currentCam.scale - prevCam.scale) * mix;

    return { tx, ty, scale, activeEdgeId: null, drawProgress: 1.0 };
  }, [cameraStatesPerScene, currentSceneIndex, frame, sceneRanges, fps, graphEvents, currentGraphState]);

  // Contextual screen shake computation matching VideoReel.tsx
  const canvasTransform = useMemo(() => {
    const activeScene = scenes[currentSceneIndex];
    const activeSceneRange = sceneRanges[currentSceneIndex];
    if (!activeScene || !activeSceneRange) {
      return 'none';
    }
    const isShake = activeScene.shake || activeScene.transition === 'shake';
    const isZoom = activeScene.zoom || activeScene.transition === 'zoom-in' || activeScene.transition === 'zoom-out';
    if (!isShake && !isZoom) {
      return 'none';
    }
    const relativeFrame = frame - activeSceneRange.startFrame;
    const durationInFrames = Math.max(1, activeSceneRange.endFrame - activeSceneRange.startFrame);
    const intensity = activeScene.shakeIntensity || 15;
    const speed = activeScene.shakeSpeed || 15;
    const t = relativeFrame / fps;
    const dx = isShake ? intensity * Math.sin(2 * Math.PI * t * speed) : 0;
    const dy = isShake ? intensity * Math.cos(2 * Math.PI * t * (speed * 1.25)) : 0;
    const baseScale = isShake ? (1.0 + intensity / 300) : 1.0;
    const zoomScale = isZoom ? (1.0 + 0.1 * (relativeFrame / durationInFrames)) : 1.0;
    const scaleVal = baseScale * zoomScale;
    return `scale(${scaleVal}) translate(${dx}px, ${dy}px)`;
  }, [scenes, currentSceneIndex, sceneRanges, frame, fps]);

  // Renders the network edge lines
  const renderEdges = () => {
    const edgesArray: React.ReactNode[] = [];
    const canvasHeight = height * 0.65;
    currentGraphState.activeEdges.forEach((edge, edgeId) => {
      const fromNode = currentGraphState.activeNodes.get(edge.from);
      const toNode = currentGraphState.activeNodes.get(edge.to);

      if (fromNode && toNode) {
        const isNewEdge = edge.entryFrame === sceneRanges[currentSceneIndex]?.startFrame;
        const isCinematicEdge = camera.activeEdgeId === edgeId || (camera.activeEdgeId && isNewEdge);
        
        let focusProgress = 1.0;
        if (connectionFocus.active) {
          if (connectionFocus.involvedEdgeIds.has(edgeId)) {
            focusProgress = 1.0;
          } else {
            focusProgress = connectionFocus.focusProgress;
          }
        }

        edgesArray.push(
          <StoryEdge
            key={edgeId}
            id={edgeId}
            fromX={(fromNode.x / 100) * width}
            fromY={(fromNode.y / 100) * canvasHeight}
            toX={(toNode.x / 100) * width}
            toY={(toNode.y / 100) * canvasHeight}
            label={edge.label}
            sentiment={edge.sentiment}
            active={edge.active}
            entryFrame={edge.entryFrame}
            width={width}
            height={canvasHeight}
            customDrawProgress={isCinematicEdge ? camera.drawProgress : undefined}
            focusProgress={focusProgress}
          />
        );
      }
    });
    return edgesArray;
  };

  // Renders the graph nodes
  const renderNodes = () => {
    const nodesArray: React.ReactNode[] = [];
    const hasActiveNode = Array.from(currentGraphState.activeNodes.values()).some((n) => n.active);

    currentGraphState.activeNodes.forEach((node, nodeId) => {
      const entity = entities.find((e) => e.id === nodeId);
      if (entity) {
        let isFocused = node.active;
        let focusProgress = 1.0;
        
        if (connectionFocus.active) {
          if (connectionFocus.involvedNodes.has(nodeId)) {
            isFocused = true;
            focusProgress = 1.0;
          } else {
            isFocused = node.active;
            focusProgress = connectionFocus.focusProgress;
          }
        }

        nodesArray.push(
          <StoryNode
            key={nodeId}
            id={nodeId}
            name={entity.name}
            type={entity.type}
            x={node.x}
            y={node.y}
            active={isFocused}
            entryFrame={node.entryFrame}
            hasActiveNode={hasActiveNode || connectionFocus.active}
            focusProgress={focusProgress}
          />
        );
      }
    });
    return nodesArray;
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '65%',
        overflow: 'hidden',
        background: 'transparent',
        zIndex: 10,
        transform: canvasTransform,
      }}
    >
      {/* Dynamic Camera Pan Wrapper */}
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transform: `translate(${camera.tx}%, ${camera.ty}%)`,
        }}
      >
        {/* Dynamic Camera Zoom Wrapper */}
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            transform: `scale(${camera.scale})`,
            transformOrigin: `${50 - camera.tx}% ${45 - camera.ty}%`,
          }}
        >
          {/* SVG Canvas layer for drawing relationship paths */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 2,
            }}
            viewBox={`0 0 ${width} ${height * 0.65}`}
          >
            <defs>
              {/* Soft shadow/glow filters for connections */}
              <filter id="edge-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {renderEdges()}
          </svg>

          {/* HTML/CSS layers for Nodes & Badges */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 3,
            }}
          >
            {renderNodes()}
          </div>
        </div>
      </div>
    </div>
  );
};
