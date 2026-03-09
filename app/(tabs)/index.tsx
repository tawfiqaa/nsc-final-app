import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { addDays, endOfMonth, getDay, isAfter, isSameDay, startOfDay, startOfMonth } from 'date-fns';
import { useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { DashboardEmptyState } from '../../src/components/DashboardEmptyState';
import { LogCard } from '../../src/components/LogCard';
import { ScheduleCard } from '../../src/components/ScheduleCard';
import { SectionContainer } from '../../src/components/SectionContainer';
import { StatsWidget } from '../../src/components/StatsWidget';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLesson } from '../../src/contexts/LessonContext';
import { useOrg } from '../../src/contexts/OrgContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { db } from '../../src/lib/firebase';
import { AttendanceStatus, PayrollSettings } from '../../src/types';
import { useFormatting } from '../../src/utils/formatters';
import { computePayrollTotals } from '../../src/utils/payroll';

export default function Dashboard() {
  const { user } = useAuth();
  const { schedules, logs, markAttendance, deleteLog, refresh, loading, updateLogNotes, schools } = useLesson();
  const { colors, fonts, tokens, theme } = useTheme();
  const { spacing, radius, interaction } = tokens;
  const { membershipRole } = useOrg();
  const { t } = useTranslation();
  const { formatDate, formatNumber, formatCurrency } = useFormatting();
  const router = useRouter();

  // No role-based redirect here to match previous state

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

    return computePayrollTotals(logs, payrollSettings, start, end);
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

  // Recent Activity = last 3 by lesson date/time
  const recentLogs = useMemo(() => {
    return [...logs]
      .sort((a, b) => {
        const dateCompare = new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime();
        if (dateCompare !== 0) return dateCompare;
        // If same date, sort by start time (HH:mm)
        return (b.startTime || '').localeCompare(a.startTime || '');
      })
      .slice(0, 3);
  }, [logs]);

  // Upcoming lessons for next 7 days (recurring and one-time)
  const upcomingLessons = useMemo(() => {
    const now = startOfDay(new Date());
    const days: any[] = [];

    // Check next 6 days (excluding today which is in todaysLessons)
    for (let i = 1; i <= 6; i++) {
      const checkDate = addDays(now, i);
      const dayOfWeek = getDay(checkDate);

      const daySchedules = schedules.filter(s =>
        s.isActive !== false &&
        s.dayOfWeek === dayOfWeek
      ).map(s => ({ ...s, upcomingDate: checkDate }));

      days.push(...daySchedules);
    }

    // Also include one-time logs that are in the future
    const upcomingOneTime = logs.filter(l =>
      l.isOneTime &&
      isAfter(startOfDay(new Date(l.dateISO)), now) &&
      !isSameDay(new Date(l.dateISO), now)
    ).map(l => ({ ...l, upcomingDate: new Date(l.dateISO) }));

    return [...days].sort((a, b) => a.upcomingDate.getTime() - b.upcomingDate.getTime());
  }, [schedules, logs]);

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

  const textStyle = { fontFamily: fonts.regular, color: colors.textPrimary };
  const boldStyle = { fontFamily: fonts.bold, color: colors.textPrimary };
  const secondaryStyle = { fontFamily: fonts.regular, color: colors.textSecondary };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accentPrimary} />}
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
            activeOpacity={interaction.pressedOpacity}
            style={[
              styles.totalCardHome,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
                borderWidth: 1,
                borderRadius: radius.large,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: theme === 'light' ? 0.05 : 0.1,
                shadowRadius: 12,
                elevation: theme === 'light' ? 2 : 4,
              }
            ]}
            onPress={() => router.push('/payroll' as any)}
          >
            <Text style={[styles.totalLabelHome, secondaryStyle]}>{t('dashboard.totalMonth')}</Text>
            {monthlyStats.ratesMissing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <FontAwesome5 name="coins" size={22} color={colors.accentPrimary} />
                <Text style={[styles.totalValueHome, { color: colors.accentPrimary, fontFamily: fonts.bold }]}>
                  {t('dashboard.setRates')}
                </Text>
              </View>
            ) : (
              <Text style={[styles.totalValueHome, { color: colors.accentPrimary, fontFamily: fonts.bold }]}>
                {formatCurrency(monthlyStats.totalPay, payrollSettings?.currency || 'ILS')}
              </Text>
            )}
            <View style={[
              styles.actionPill,
              { backgroundColor: colors.backgroundSecondary, borderRadius: radius.medium }
            ]}>
              <Text style={[
                secondaryStyle,
                { fontSize: 12, fontFamily: fonts.medium, color: colors.accentPrimary }
              ]}>
                {t('dashboard.tapToViewDetails')}
              </Text>
              <Ionicons
                name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"}
                size={16}
                color={colors.accentPrimary}
                style={I18nManager.isRTL ? { marginRight: 4 } : { marginLeft: 4 }}
              />
            </View>
          </TouchableOpacity>
        </View>

        <SectionContainer
          title={t('dashboard.sections.today')}
          subtitle={formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}
        >
          {todaysLessons.length === 0 ? (
            <DashboardEmptyState
              icon="calendar-outline"
              message={t('dashboard.noMoreLessonsToday')}
              action={() => router.push('/add-lesson' as any)}
              actionText={t('dashboard.createLesson')}
            />
          ) : (
            todaysLessons.map(schedule => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                onMark={(status) => handleMark(schedule.id, status)}
                schoolLocation={schools.find(s => s.name === schedule.school)?.location}
              />
            ))
          )}
        </SectionContainer>

        <SectionContainer
          title={t('dashboard.sections.upcoming')}
          subtitle={t('dashboard.sections.nextSevenDays')}
        >
          {upcomingLessons.length === 0 ? (
            <DashboardEmptyState
              icon="time-outline"
              message={t('dashboard.noUpcomingLessons')}
              action={() => router.push('/add-lesson' as any)}
              actionText={t('dashboard.createLesson')}
            />
          ) : (
            upcomingLessons.slice(0, 3).map((item, idx) => (
              <View key={`${item.id}-${idx}`} style={{ opacity: 0.85, marginBottom: idx === 2 ? 0 : 12 }}>
                <ScheduleCard
                  schedule={item}
                  isUpcoming={true}
                  upcomingDate={item.upcomingDate}
                  onMark={() => { }}
                  compact={true}
                  schoolLocation={schools.find(s => s.name === item.school)?.location}
                />
              </View>
            ))
          )}
        </SectionContainer>

        <SectionContainer
          title={t('dashboard.sections.recentActivity')}
          rightAction={
            recentLogs && recentLogs.length > 0 ? (
              <TouchableOpacity onPress={() => router.push('/school-history' as any)}>
                <Text style={{ color: colors.accentPrimary, fontFamily: fonts.bold, fontSize: 13 }}>
                  {t('common.viewAll')}
                </Text>
              </TouchableOpacity>
            ) : undefined
          }
        >
          {recentLogs.length === 0 ? (
            <DashboardEmptyState
              icon="flash-outline"
              message={t('dashboard.noRecentActivity')}
              action={() => router.push('/history' as any)}
              actionText={t('dashboard.viewCalendar')}
            />
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
        </SectionContainer>
      </ScrollView>


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
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radius.large, borderColor: colors.borderSubtle, borderWidth: 1 }]}>
            <Text style={[styles.modalTitle, boldStyle]}>
              {markingSchedule ? t('dashboard.lessonNotesOptional') : editingLog?.notes ? t('dashboard.editNote') : t('dashboard.addNote')}
            </Text>

            <TextInput
              style={[
                styles.textInput,
                {
                  color: colors.textPrimary,
                  borderColor: colors.borderSubtle,
                  backgroundColor: colors.backgroundSecondary,
                  fontFamily: fonts.regular,
                  borderRadius: radius.medium
                }
              ]}
              placeholder={t('dashboard.notesPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={notesInput}
              onChangeText={setNotesInput}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: colors.borderSubtle, borderWidth: 1 }]}
                onPress={() => {
                  setMarkingSchedule(null);
                  setEditingLog(null);
                }}
              >
                <Text style={[textStyle, { fontWeight: '600' }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.accentPrimary }]}
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
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 16,
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
