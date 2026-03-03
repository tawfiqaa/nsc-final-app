import { Ionicons } from '@expo/vector-icons';
import { endOfMonth, getDay, isSameDay, startOfMonth } from 'date-fns';
import { useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LogCard } from '../../src/components/LogCard';
import { ScheduleCard } from '../../src/components/ScheduleCard';
import { StatsWidget } from '../../src/components/StatsWidget';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLesson } from '../../src/contexts/LessonContext';
import { useOrg } from '../../src/contexts/OrgContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { db } from '../../src/lib/firebase';
import { AttendanceStatus, PayrollSettings } from '../../src/types';
import { useFormatting } from '../../src/utils/formatters';

export default function Dashboard() {
  const { user } = useAuth();
  const { schedules, logs, markAttendance, deleteLog, refresh, loading, updateLogNotes } = useLesson();
  const { colors, fonts } = useTheme();
  const { membershipRole } = useOrg();
  const { t } = useTranslation();
  const { formatDate, formatNumber, formatCurrency } = useFormatting();
  const router = useRouter();

  const isOrgAdmin = membershipRole === 'admin' || membershipRole === 'owner';
  const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';
  const isRestrictedAdmin = isOrgAdmin && !isSuperAdmin;

  React.useEffect(() => {
    if (isRestrictedAdmin) {
      router.replace('/(tabs)/admin');
    }
  }, [isRestrictedAdmin]);

  if (isRestrictedAdmin) return null; // Prevent flicker before redirect

  const [markingSchedule, setMarkingSchedule] = useState<{ id: string, status: AttendanceStatus } | null>(null);
  const [editingLog, setEditingLog] = useState<typeof logs[0] | null>(null);
  const [notesInput, setNotesInput] = useState('');
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings | null>(null);

  const today = new Date();

  // Load Payroll Settings (Real-time sync)
  React.useEffect(() => {
    if (!user) {
      setPayrollSettings(null);
      return;
    }
    const docRef = doc(db, 'users', user.uid, 'settings', 'payroll');
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setPayrollSettings(docSnap.data() as PayrollSettings);
      } else {
        setPayrollSettings(null);
      }
    }, (error) => {
      console.error('Error listening to payroll settings', error);
    });
    return () => unsub();
  }, [user]);

  // Filter logs for this month
  const monthlyStats = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);

    const monthLogs = logs.filter(log => {
      const d = new Date(log.dateISO);
      return d >= start && d <= end && log.status === 'present';
    });

    const totalHours = monthLogs.reduce((acc, log) => acc + log.hours, 0);
    const totalDistance = monthLogs.reduce((acc, log) => acc + log.distance, 0);

    const hourlyRate = payrollSettings?.hourlyRate || 0;
    const kmRate = payrollSettings?.kmRate || 0;
    const totalPay = (totalHours * hourlyRate) + (totalDistance * kmRate);
    const ratesMissing = !payrollSettings || (hourlyRate === 0 && kmRate === 0);

    return { totalHours, totalDistance, totalPay, ratesMissing };
  }, [logs, payrollSettings]);

  // Today's lessons (schedules that haven't been logged today)
  const todaysLessons = useMemo(() => {
    const now = new Date();
    const todayDayOfWeek = getDay(now);

    return schedules.filter(schedule => {
      // Must be active
      if (schedule.isActive === false) return false;

      // Must match day of week
      if (schedule.dayOfWeek !== todayDayOfWeek) return false;

      // Must not be already logged today
      const isLogged = logs.some(log =>
        log.scheduleId === schedule.id &&
        isSameDay(new Date(log.dateISO), now)
      );

      return !isLogged;
    });
  }, [schedules, logs]);

  // Recently updated logs (last 12 hours OR upcoming one-time lessons)
  const recentLogs = useMemo(() => {
    const now = new Date();
    const cutoff = now.getTime() - (12 * 60 * 60 * 1000);

    return [...logs]
      .filter(log => {
        const lessonDate = new Date(log.dateISO);
        // Rule 1: Always show one-time lessons if they are for today or the future
        if (log.isOneTime && (isSameDay(lessonDate, now) || lessonDate > now)) {
          return true;
        }
        // Rule 2: Show ANY lesson (recurring or one-time) if it was updated in the last 12 hours
        return log.updatedAt >= cutoff;
      })
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

  const textStyle = { fontFamily: fonts.regular, color: colors.text };
  const boldStyle = { fontFamily: fonts.bold, color: colors.text };
  const secondaryStyle = { fontFamily: fonts.regular, color: colors.secondaryText };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, secondaryStyle]}>{t('dashboard.goodDay')}</Text>
            <Text style={[styles.username, boldStyle]}>{user?.name || user?.email?.split('@')[0]}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatsWidget title={t('dashboard.hoursMonth')} value={formatNumber(monthlyStats.totalHours, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} unit="h" />
          <StatsWidget title={t('dashboard.distanceMonth')} value={formatNumber(monthlyStats.totalDistance, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} unit="km" />
        </View>

        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <TouchableOpacity
            style={[styles.totalCardHome, { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1 }]}
            onPress={() => router.push('/payroll' as any)}
          >
            <Text style={[styles.totalLabelHome, secondaryStyle]}>{t('dashboard.totalMonth')}</Text>
            <Text style={[styles.totalValueHome, { color: colors.primary, fontFamily: fonts.bold }]}>
              {monthlyStats.ratesMissing ? t('dashboard.setRates') : formatCurrency(monthlyStats.totalPay, payrollSettings?.currency || 'ILS')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Text style={[secondaryStyle, { fontSize: 11 }]}>{t('dashboard.tapToViewDetails')}</Text>
              <Ionicons name="chevron-forward" size={12} color={colors.secondaryText} style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, boldStyle]}>{t('dashboard.todaysLessons')}</Text>
        {todaysLessons.length === 0 ? (
          <Text style={[styles.emptyText, secondaryStyle]}>{t('dashboard.noMoreLessonsToday')}</Text>
        ) : (
          todaysLessons.map(schedule => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              onMark={(status) => handleMark(schedule.id, status)}
            />
          ))
        )}

        <Text style={[styles.sectionTitle, boldStyle, { marginTop: 24 }]}>{t('dashboard.recentlyUpdated')}</Text>
        {recentLogs.length === 0 ? (
          <Text style={[styles.emptyText, secondaryStyle]}>{t('dashboard.noRecentActivity')}</Text>
        ) : (
          recentLogs.map(log => (
            <LogCard
              key={log.id}
              log={log}
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
            <Text style={[styles.modalTitle, boldStyle]}>
              {markingSchedule ? t('dashboard.lessonNotesOptional') : editingLog?.notes ? t('dashboard.editNote') : t('dashboard.addNote')}
            </Text>

            <TextInput
              style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, fontFamily: fonts.regular }]}
              placeholder={t('dashboard.notesPlaceholder')}
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
                <Text style={[textStyle, { fontWeight: '600' }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={markingSchedule ? confirmMark : confirmEditNote}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontFamily: fonts.bold }}>{t('common.save')}</Text>
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
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  totalCardHome: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  totalLabelHome: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  totalValueHome: {
    fontSize: 28,
    fontWeight: '700',
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
