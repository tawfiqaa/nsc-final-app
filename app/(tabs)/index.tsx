import { Ionicons } from '@expo/vector-icons';
import { endOfMonth, format, getDay, isSameDay, startOfMonth } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LogCard } from '../../src/components/LogCard';
import { ScheduleCard } from '../../src/components/ScheduleCard';
import { StatsWidget } from '../../src/components/StatsWidget';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLesson } from '../../src/contexts/LessonContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { AttendanceStatus } from '../../src/types';

export default function Dashboard() {
  const { user } = useAuth();
  const { schedules, logs, markAttendance, toggleLogStatus, deleteLog, refresh, loading, updateLogNotes } = useLesson();
  const { colors, theme } = useTheme();
  const router = useRouter();

  const [markingSchedule, setMarkingSchedule] = useState<{ id: string, status: AttendanceStatus } | null>(null);
  const [editingLog, setEditingLog] = useState<typeof logs[0] | null>(null);
  const [notesInput, setNotesInput] = useState('');

  const today = new Date();
  const todayDayOfWeek = getDay(today);

  // Filter logs for this month
  const monthlyStats = useMemo(() => {
    const start = startOfMonth(today);
    const end = endOfMonth(today);

    // Simple filter by dateISO string check, robust enough for ISO format
    const monthLogs = logs.filter(log => {
      const d = new Date(log.dateISO);
      return d >= start && d <= end && log.status === 'present';
    });

    const totalHours = monthLogs.reduce((acc, log) => acc + log.hours, 0);
    const totalDistance = monthLogs.reduce((acc, log) => acc + log.distance, 0);

    return { totalHours, totalDistance };
  }, [logs]);

  // Today's lessons (schedules that haven't been logged today)
  const todaysLessons = useMemo(() => {
    return schedules.filter(schedule => {
      // Must be active
      if (schedule.isActive === false) return false;

      // Must match day of week
      if (schedule.dayOfWeek !== todayDayOfWeek) return false;

      // Must not be already logged today
      const isLogged = logs.some(log =>
        log.scheduleId === schedule.id &&
        isSameDay(new Date(log.dateISO), today)
      );

      return !isLogged;
    });
  }, [schedules, logs, todayDayOfWeek]);

  // Recently updated logs (last 12 hours)
  const recentLogs = useMemo(() => {
    // 12 hours ago
    const cutoff = Date.now() - (12 * 60 * 60 * 1000);
    return [...logs]
      .filter(log => log.updatedAt >= cutoff)
      .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());
  }, [logs]);

  const handleMark = (scheduleId: string, status: AttendanceStatus) => {
    setMarkingSchedule({ id: scheduleId, status });
    setNotesInput('');
  };

  const confirmMark = async () => {
    if (!markingSchedule) return;
    const schedule = schedules.find(s => s.id === markingSchedule.id);
    if (schedule) {
      await markAttendance(schedule, markingSchedule.status, new Date().toISOString(), notesInput.trim());
    }
    setMarkingSchedule(null);
  };

  const handleEditNote = (log: typeof logs[0]) => {
    setEditingLog(log);
    setNotesInput(log.notes || '');
  };

  const confirmEditNote = async () => {
    if (!editingLog) return;
    await updateLogNotes(editingLog.id, notesInput.trim());
    setEditingLog(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.secondaryText }]}>Good day,</Text>
            <Text style={[styles.username, { color: colors.text }]}>{user?.email?.split('@')[0]}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.date, { color: colors.primary }]}>{format(today, 'EEE, MMM d')}</Text>
            {/* ThemeToggle is in generic header usually, but good here too */}
            <ThemeToggle />
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatsWidget title="Hours (Mo)" value={monthlyStats.totalHours.toFixed(1)} unit="h" />
          <StatsWidget title="Distance (Mo)" value={monthlyStats.totalDistance.toFixed(1)} unit="km" />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Lessons</Text>
        {todaysLessons.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.secondaryText }]}>No more lessons today.</Text>
        ) : (
          todaysLessons.map(schedule => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              onMark={(status) => handleMark(schedule.id, status)}
            />
          ))
        )}

        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Recently Updated</Text>
        {recentLogs.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.secondaryText }]}>No recent activity.</Text>
        ) : (
          recentLogs.map(log => (
            <LogCard
              key={log.id}
              log={log}
              onToggle={() => toggleLogStatus(log.id)}
              onDelete={() => deleteLog(log.id)}
              onEditNote={() => handleEditNote(log)}
            />
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/add-lesson')}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Modal for Notes (Add/Edit) */}
      <Modal
        visible={!!markingSchedule || !!editingLog}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setMarkingSchedule(null);
          setEditingLog(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {markingSchedule ? 'Lesson Notes (Optional)' : editingLog?.notes ? 'Edit Note' : 'Add Note'}
            </Text>

            <TextInput
              style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="e.g. Covered Chapter 3, student was late..."
              placeholderTextColor={colors.secondaryText}
              value={notesInput}
              onChangeText={setNotesInput}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => {
                  setMarkingSchedule(null);
                  setEditingLog(null);
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={markingSchedule ? confirmMark : confirmEditNote}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100, // Space for FAB
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  date: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 24,
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  emptyText: {
    fontStyle: 'italic',
    marginBottom: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
});
