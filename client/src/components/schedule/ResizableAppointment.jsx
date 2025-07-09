import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

export default function ResizableAppointment({
  group,
  serviceType,
  serviceTypeColors,
  formatPatientName,
  formatFullPatientName,
  formatTime,
  onResize,
  onAppointmentClick,
  checkAvailability,
  slotHeight = 64,
  children
}) {
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState(null); // 'top' or 'bottom'
  const [tempHeight, setTempHeight] = useState(null);
  const containerRef = useRef(null);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const startTop = useRef(0);

  // Calculate initial height based on span
  const calculateSpan = () => {
    const start = new Date(group.startTime);
    const end = new Date(group.endTime);
    const durationMinutes = (end - start) / (1000 * 60);
    return Math.ceil(durationMinutes / 30);
  };

  const initialHeight = (calculateSpan() * slotHeight) - 4;

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;

      const deltaY = e.clientY - startY.current;
      
      if (resizeDirection === 'bottom') {
        // Resizing from bottom - increase/decrease height
        const newHeight = Math.max(slotHeight - 8, startHeight.current + deltaY);
        // Round to nearest slot height
        const slots = Math.round((newHeight + 4) / slotHeight);
        const snappedHeight = (slots * slotHeight) - 4;
        
        // Check if the new duration is available
        const newDurationMinutes = slots * 30;
        const newEndTime = new Date(new Date(group.startTime).getTime() + newDurationMinutes * 60000);
        
        if (checkAvailability && !checkAvailability(group.startTime, newEndTime.toISOString(), group.therapistId, group.id)) {
          return; // Not available
        }
        
        setTempHeight(snappedHeight);
      } else if (resizeDirection === 'top') {
        // Resizing from top - adjust both position and height
        const newHeight = Math.max(slotHeight - 8, startHeight.current - deltaY);
        const slots = Math.round((newHeight + 4) / slotHeight);
        const snappedHeight = (slots * slotHeight) - 4;
        
        // Calculate new start time
        const originalSlots = Math.round((startHeight.current + 8) / slotHeight);
        const slotDifference = originalSlots - slots;
        const newStartTime = new Date(new Date(group.startTime).getTime() - (slotDifference * 30 * 60000));
        
        if (checkAvailability && !checkAvailability(newStartTime.toISOString(), group.endTime, group.therapistId, group.id)) {
          return; // Not available
        }
        
        setTempHeight(snappedHeight);
      }
    };

    const handleMouseUp = () => {
      if (!isResizing) return;

      // Calculate final times based on temp height
      if (tempHeight !== null) {
        const slots = Math.round((tempHeight + 4) / slotHeight);
        
        if (resizeDirection === 'bottom') {
          const newDurationMinutes = slots * 30;
          const newEndTime = new Date(new Date(group.startTime).getTime() + newDurationMinutes * 60000);
          onResize(group.id, group.startTime, newEndTime.toISOString());
        } else if (resizeDirection === 'top') {
          const originalSlots = Math.round((startHeight.current + 4) / slotHeight);
          const slotDifference = originalSlots - slots;
          const newStartTime = new Date(new Date(group.startTime).getTime() - (slotDifference * 30 * 60000));
          onResize(group.id, newStartTime.toISOString(), group.endTime);
        }
      }

      setIsResizing(false);
      setResizeDirection(null);
      setTempHeight(null);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, resizeDirection, tempHeight, group, slotHeight, onResize, checkAvailability]);

  const handleResizeStart = (e, direction) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    startY.current = e.clientY;
    startHeight.current = containerRef.current?.offsetHeight || initialHeight;
    startTop.current = containerRef.current?.offsetTop || 0;
  };

  const displayHeight = tempHeight !== null ? tempHeight : initialHeight;

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute inset-x-1 top-0 rounded-md text-center text-sm cursor-pointer transition-all hover:shadow-md",
        "flex flex-col justify-center",
        serviceTypeColors[serviceType] || serviceTypeColors.direct,
        isResizing && "shadow-lg opacity-90"
      )}
      style={{
        height: `${displayHeight}px`,
        zIndex: isResizing ? 999 : 10,
        userSelect: isResizing ? 'none' : 'auto'
      }}
      onClick={() => !isResizing && onAppointmentClick(group.appointments[0])}
      title={`${formatFullPatientName(group.patient)} - ${formatTime(group.startTime)} to ${formatTime(group.endTime)}`}
    >
      {/* Top resize handle */}
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-black hover:bg-opacity-10"
        onMouseDown={(e) => handleResizeStart(e, 'top')}
      />
      
      {/* Bottom resize handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-black hover:bg-opacity-10"
        onMouseDown={(e) => handleResizeStart(e, 'bottom')}
      />
      
      {/* Content */}
      <div className="px-2">
        {children}
      </div>
      
      {/* Visual indicator when resizing */}
      {isResizing && (
        <div className="absolute inset-0 border-2 border-blue-500 rounded-md pointer-events-none" />
      )}
    </div>
  );
}