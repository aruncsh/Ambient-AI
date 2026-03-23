import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface AudioVisualizerProps {
    isActive: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive }) => {
    const bars = Array.from({ length: 40 });

    return (
        <div className="flex items-center justify-center gap-[2px] h-12 w-full px-4 overflow-hidden">
            {bars.map((_, i) => (
                <motion.div
                    key={i}
                    animate={{
                        height: isActive 
                            ? [8, Math.random() * 30 + 10, 8] 
                            : [4, 4, 4],
                    }}
                    transition={{
                        duration: 0.5 + Math.random() * 0.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="w-1 rounded-full bg-gradient-to-t from-primary to-secondary opacity-60"
                />
            ))}
        </div>
    );
};

export default AudioVisualizer;
