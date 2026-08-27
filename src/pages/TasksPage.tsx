import React, { useState, useEffect, useMemo } from 'react';
import { getTasks, updateTaskStatus } from '../api';
import { StudentTask, TaskStatus } from '../types';
import { TaskCard } from '../components/tasks/TaskCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Tabs } from '../components/ui/Tabs';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import { formatDate, cn } from '../lib/utils';
import {
  ClipboardList,
  Award,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Check,
  Clock,
  AlertCircle,
} from 'lucide-react';

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<StudentTask | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const { showToast } = useToast();

  const fetchTaskList = async () => {
    try {
      setIsLoading(true);
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      console.warn('Tasks load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskList();
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (activeTab === 'all') return true;
      if (activeTab === 'today') return task.status === 'PENDING' || task.status === 'IN_PROGRESS';
      if (activeTab === 'upcoming') return task.status === 'PENDING';
      if (activeTab === 'completed') return task.status === 'COMPLETED';
      if (activeTab === 'overdue') return task.status === 'OVERDUE';
      return true;
    });
  }, [tasks, activeTab]);

  const completedCount = tasks.filter(t => t.status === 'COMPLETED').length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const totalXpEarned = tasks
    .filter(t => t.status === 'COMPLETED')
    .reduce((acc, curr) => acc + curr.rewardXP, 0);

  const handleCompleteTask = async (taskId: string) => {
    try {
      const updated = await updateTaskStatus(taskId, 'COMPLETED');
      if (updated) {
        showToast(
          'success',
          'Task Completed!',
          `You earned +${updated.rewardXP} XP and +$${updated.rewardCredit}.00 training credit.`
        );
        setTasks(prev => prev.map(t => (t.id === taskId ? updated : t)));
        if (selectedTask?.id === taskId) {
          setSelectedTask(updated);
        }
      }
    } catch (err: any) {
      showToast('error', 'Update Failed', err.message);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-gold-500/25 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-gold-400" />
              <span>Training Modules &amp; Tasks</span>
            </h2>
            <Badge status="IN_PROGRESS" size="sm" dot>
              ACTIVE CURRICULUM
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Structured trading assignments, risk calibration drills, and compliance milestones
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="p-2.5 rounded-xl bg-surface-elevated border border-gold-500/30 flex items-center gap-2 text-gold-400 font-bold">
            <Award className="w-4 h-4" />
            <span>Total XP: {totalXpEarned}</span>
          </div>
        </div>
      </div>

      {/* Progress & Milestone Overview Card */}
      <Card variant="royal" className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100">Stage 3 Programme Progress</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Complete assigned technical tasks to unlock advanced institutional execution tiers.
            </p>
          </div>
          <div className="text-right font-mono">
            <span className="text-2xl font-black text-gold-400">{completedCount}</span>
            <span className="text-slate-500"> / {tasks.length} Modules ({progressPercent}%)</span>
          </div>
        </div>

        <div className="w-full bg-surface-elevated h-2.5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-gold-500 via-gold-400 to-gold-300 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </Card>

      {/* Filter Tabs */}
      <Tabs
        tabs={[
          { id: 'all', label: 'All Modules', count: tasks.length },
          { id: 'today', label: 'Today / Active', count: tasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'PENDING').length },
          { id: 'completed', label: 'Completed', count: completedCount },
          { id: 'overdue', label: 'Overdue', count: tasks.filter(t => t.status === 'OVERDUE').length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="segmented"
        className="max-w-xl"
      />

      {/* Task Cards Grid */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          title="No Tasks in this Category"
          description="All tasks matching this filter are up to date."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onSelect={setSelectedTask}
              onComplete={handleCompleteTask}
            />
          ))}
        </div>
      )}

      {/* Task Details Modal */}
      <Modal
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title={selectedTask?.title}
        description={`Category: ${selectedTask?.category}  •  Due: ${formatDate(selectedTask?.dueDate)}`}
        maxWidth="lg"
      >
        {selectedTask && (
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border/60 text-xs font-mono">
              <div className="flex items-center gap-2">
                <Badge status={selectedTask.status} size="sm" dot>
                  {selectedTask.status.replace('_', ' ')}
                </Badge>
                <span className="text-slate-400">Priority: <strong>{selectedTask.priority}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-gold-400 font-bold">
                <Award className="w-4 h-4" />
                <span>+{selectedTask.rewardXP} XP  •  +${selectedTask.rewardCredit}.00</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-slate-300 font-mono tracking-wider mb-1">
                Objective
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                {selectedTask.description}
              </p>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-300 font-mono tracking-wider">
                Execution Instructions
              </h4>
              <div className="space-y-2">
                {selectedTask.instructions.map((inst, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-surface-elevated/70 border border-border/60 text-xs text-slate-300 flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-gold-500/20 text-gold-400 flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{inst}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Requirements Checklist */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-300 font-mono tracking-wider">
                Completion Criteria
              </h4>
              <div className="space-y-1.5">
                {selectedTask.requirements.map((req, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{req}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
              <Button
                variant="outline"
                size="md"
                onClick={() => setSelectedTask(null)}
              >
                Close
              </Button>
              {selectedTask.status !== 'COMPLETED' && (
                <Button
                  variant="royal"
                  size="md"
                  onClick={() => handleCompleteTask(selectedTask.id)}
                  leftIcon={<Check className="w-4 h-4 text-slate-950" />}
                >
                  Mark Module Completed
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
