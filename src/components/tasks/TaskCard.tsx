import React from 'react';
import { StudentTask } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { formatDate, cn } from '../../lib/utils';
import { Calendar, Award, CheckCircle, Clock, ChevronRight } from 'lucide-react';

interface TaskCardProps {
  task: StudentTask;
  onSelect: (task: StudentTask) => void;
  onComplete?: (taskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onSelect, onComplete }) => {
  const isCompleted = task.status === 'COMPLETED';
  const isOverdue = task.status === 'OVERDUE';

  const priorityColors = {
    HIGH: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    MEDIUM: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    LOW: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  };

  return (
    <Card
      className={cn(
        'p-5 transition-all duration-200 hover:border-indigo-500/40 cursor-pointer flex flex-col justify-between group',
        isCompleted && 'opacity-85 bg-surface/50 border-emerald-500/20'
      )}
      onClick={() => onSelect(task)}
    >
      <div>
        {/* Category, Priority & Status Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-indigo-400 font-mono tracking-wider">
              {task.category}
            </span>
            <span
              className={cn(
                'text-[10px] font-extrabold px-1.5 py-0.5 rounded border uppercase font-mono',
                priorityColors[task.priority]
              )}
            >
              {task.priority}
            </span>
          </div>

          <Badge status={task.status} size="sm" dot>
            {task.status.replace('_', ' ')}
          </Badge>
        </div>

        {/* Task Title & Description */}
        <h4 className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition-colors leading-snug">
          {task.title}
        </h4>
        <p className="text-xs sm:text-sm text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
          {task.description}
        </p>

        {/* Progress Bar */}
        <div className="mt-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Milestone Completion</span>
            <span className="font-bold text-slate-200">{task.progressPercent}%</span>
          </div>
          <div className="w-full bg-surface-elevated h-1.5 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                isCompleted ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-cyan-500'
              )}
              style={{ width: `${task.progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer Details */}
      <div className="mt-5 pt-3 border-t border-border/40 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 text-slate-400 font-mono">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className={isOverdue ? 'text-rose-400 font-bold' : ''}>
              Due {formatDate(task.dueDate)}
            </span>
          </div>

          <div className="flex items-center gap-1 text-amber-400 font-semibold">
            <Award className="w-3.5 h-3.5" />
            <span>+{task.rewardXP} XP</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onComplete && !isCompleted && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs py-1 px-2.5 h-7"
              onClick={e => {
                e.stopPropagation();
                onComplete(task.id);
              }}
            >
              Mark Done
            </Button>
          )}
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Card>
  );
};
