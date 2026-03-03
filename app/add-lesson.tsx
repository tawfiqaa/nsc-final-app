import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { useLesson } from '../src/contexts/LessonContext';
import { useOrg } from '../src/contexts/OrgContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { formatDateDMY } from '../src/utils/datetime';
import { useFormatting } from '../src/utils/formatters';

const DAYS_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export default function AddLessonScreen() {
    const { t } = useTranslation();
    const { formatDate, formatTime } = useFormatting();
    const router = useRouter();
    const params = useLocalSearchParams();
    const scheduleId = typeof params.scheduleId === 'string' ? params.scheduleId : undefined;
    const schoolParam = typeof params.school === 'string' ? params.school : undefined;
    const modeParam = typeof params.mode === 'string' ? params.mode : undefined;

    const { user } = useAuth();
    const { addSchedules, addOneTimeLog, updateSchedule, schedules } = useLesson();
    const { membershipRole } = useOrg();
    const { colors, fonts, tokens, theme } = useTheme();
    const { radius, interaction } = tokens;

    const isOrgAdmin = membershipRole === 'admin' || membershipRole === 'owner';
    const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';
    const isRestrictedAdmin = isOrgAdmin && !isSuperAdmin;

    useEffect(() => {
        if (isRestrictedAdmin) {
            router.replace('/(tabs)/admin');
        }
    }, [isRestrictedAdmin, router]);

    if (isRestrictedAdmin) return null;

    const [isOneTime, setIsOneTime] = useState(false);
    const [school, setSchool] = useState('');
    const [selectedDays, setSelectedDays] = useState<number[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [startTime, setStartTime] = useState(new Date());
    const [oneTimeDate, setOneTimeDate] = useState(new Date());
    const [duration, setDuration] = useState('');
    const [distance, setDistance] = useState('');
    const [notes, setNotes] = useState('');
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    const isContextMode = !!(schoolParam && modeParam === 'log');

    useEffect(() => {
        if (scheduleId) {
            const sched = schedules.find(s => s.id === scheduleId);
            if (sched) {
                setSchool(sched.school);
                setSelectedDays([sched.dayOfWeek]);
                const [h, m] = sched.startTime.split(':').map(Number);
                const d = new Date();
                d.setHours(h, m, 0, 0);
                setStartTime(d);
                setDuration(sched.duration.toString());
                setDistance(sched.distance.toString());
                setIsOneTime(false);
            }
        } else if (schoolParam) {
            setSchool(schoolParam);
            if (modeParam === 'log') {
                setIsOneTime(true);
                const defaultSched = schedules.find(s => s.school === schoolParam);
                if (defaultSched) {
                    const [h, m] = defaultSched.startTime.split(':').map(Number);
                    const d = new Date();
                    d.setHours(h, m, 0, 0);
                    setStartTime(d);
                    setDuration(defaultSched.duration.toString());
                    setDistance(defaultSched.distance.toString());
                }
            }
        }
    }, [scheduleId, schedules, schoolParam, modeParam]);

    const toggleDay = (index: number) => {
        if (selectedDays.includes(index)) {
            if (selectedDays.length > 1) {
                setSelectedDays(selectedDays.filter(d => d !== index));
            }
        } else {
            setSelectedDays([...selectedDays, index].sort());
        }
    };

    const handleSave = async () => {
        if (isSaving) return;

        if (!school.trim()) {
            Alert.alert(t('addLesson.validationError'), t('addLesson.schoolRequired'));
            return;
        }
        if (!isOneTime && selectedDays.length === 0) {
            Alert.alert(t('addLesson.validationError'), t('addLesson.selectDay'));
            return;
        }
        const dur = parseFloat(duration);
        if (isNaN(dur) || dur <= 0) {
            Alert.alert(t('addLesson.validationError'), t('addLesson.invalidDuration'));
            return;
        }
        const dist = parseFloat(distance);
        if (isNaN(dist) || dist < 0) {
            Alert.alert(t('addLesson.validationError'), t('addLesson.invalidDistance'));
            return;
        }

        try {
            setIsSaving(true);
            const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
            if (scheduleId) {
                const day = selectedDays[0];
                await updateSchedule(scheduleId, {
                    school: school.trim(),
                    dayOfWeek: day,
                    startTime: timeStr,
                    duration: dur,
                    distance: dist,
                    isActive: true
                });
                Alert.alert(t('common.success'), t('addLesson.updateSuccess'));
            } else if (isOneTime) {
                const finalDateTime = new Date(oneTimeDate);
                finalDateTime.setHours(startTime.getHours());
                finalDateTime.setMinutes(startTime.getMinutes());
                finalDateTime.setSeconds(0);
                finalDateTime.setMilliseconds(0);

                const dayKey = `${finalDateTime.getFullYear()}-${(finalDateTime.getMonth() + 1).toString().padStart(2, '0')}-${finalDateTime.getDate().toString().padStart(2, '0')}`;

                await addOneTimeLog({
                    school: school.trim(),
                    status: 'present',
                    hours: dur,
                    distance: dist,
                    dateISO: finalDateTime.toISOString(),
                    localDayKey: dayKey,
                    notes: notes.trim() ? notes.trim() : undefined,
                    isOneTime: true
                });
                Alert.alert(t('common.success'), t('addLesson.oneTimeSuccess'));
            } else {
                const newSchedules = selectedDays.map(day => ({
                    school: school.trim(),
                    dayOfWeek: day,
                    startTime: timeStr,
                    duration: dur,
                    distance: dist,
                }));
                await addSchedules(newSchedules);
                Alert.alert(t('common.success'), t('addLesson.schedulesSaved', { count: selectedDays.length }));
            }
            router.back();
        } catch (e: any) {
            Alert.alert(t('common.error'), e.message || t('common.error'));
        } finally {
            setIsSaving(false);
        }
    };

    const onTimeChange = (event: any, selectedDate?: Date) => {
        setShowTimePicker(Platform.OS === 'ios');
        if (selectedDate) {
            setStartTime(selectedDate);
        }
    };

    const textStyle = { fontFamily: fonts.regular, color: colors.textPrimary };
    const boldStyle = { fontFamily: fonts.bold, color: colors.textPrimary };
    const secondaryStyle = { fontFamily: fonts.regular, color: colors.textSecondary };

    return (
        <View style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}>
            <ScrollView contentContainerStyle={styles.content}>

                {!isContextMode && (
                    <View style={[styles.typeToggle, { borderColor: colors.borderSubtle, borderRadius: radius.medium }]}>
                        <TouchableOpacity
                            activeOpacity={interaction.pressedOpacity}
                            style={[
                                styles.toggleBtn,
                                !isOneTime ? { backgroundColor: colors.accentPrimary } : { backgroundColor: colors.surface },
                                (scheduleId || isSaving) && { opacity: 0.5 }
                            ]}
                            onPress={() => !scheduleId && !isSaving && setIsOneTime(false)}
                            disabled={!!scheduleId || isSaving}
                        >
                            <Text style={[
                                styles.toggleText,
                                { fontFamily: fonts.bold },
                                !isOneTime ? { color: '#fff' } : { color: colors.textPrimary }
                            ]}>
                                {scheduleId ? t('addLesson.editingSchedule') : t('addLesson.recurring')}
                            </Text>
                        </TouchableOpacity>
                        {!scheduleId && (
                            <TouchableOpacity
                                activeOpacity={interaction.pressedOpacity}
                                style={[
                                    styles.toggleBtn,
                                    isOneTime ? { backgroundColor: colors.accentPrimary } : { backgroundColor: colors.surface },
                                    isSaving && { opacity: 0.5 }
                                ]}
                                onPress={() => !isSaving && setIsOneTime(true)}
                                disabled={isSaving}
                            >
                                <Text style={[
                                    styles.toggleText,
                                    { fontFamily: fonts.bold },
                                    isOneTime ? { color: '#fff' } : { color: colors.textPrimary }
                                ]}>
                                    {t('addLesson.oneTime')}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                <View style={styles.formGroup}>
                    <Text style={[styles.label, secondaryStyle, { fontFamily: fonts.bold }]}>{t('addLesson.schoolName')}</Text>
                    <TextInput
                        style={[
                            styles.input,
                            {
                                color: colors.textPrimary,
                                borderColor: colors.borderSubtle,
                                backgroundColor: colors.surface,
                                fontFamily: fonts.regular,
                                borderRadius: radius.large
                            },
                            isContextMode && { opacity: 0.6 }
                        ]}
                        value={school}
                        onChangeText={setSchool}
                        placeholder={t('addLesson.schoolPlaceholder')}
                        placeholderTextColor={colors.textSecondary}
                        editable={!isContextMode}
                    />
                </View>

                {!isOneTime && (
                    <View style={styles.formGroup}>
                        <Text style={[styles.label, secondaryStyle, { fontFamily: fonts.bold }]}>{t('addLesson.daysOfWeek')}</Text>
                        <Text style={[styles.helper, secondaryStyle]}>{t('addLesson.daysHelper')}</Text>
                        <View style={styles.daysContainer}>
                            {DAYS_KEYS.map((dayKey, index) => {
                                const isSelected = selectedDays.includes(index);
                                return (
                                    <TouchableOpacity
                                        activeOpacity={interaction.pressedOpacity}
                                        key={dayKey}
                                        style={[
                                            styles.dayChip,
                                            isSelected ? { backgroundColor: colors.accentPrimary } : { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderWidth: 1 }
                                        ]}
                                        onPress={() => toggleDay(index)}
                                    >
                                        <Text style={[
                                            styles.dayText,
                                            { fontFamily: fonts.bold },
                                            isSelected ? { color: '#fff' } : { color: colors.textPrimary }
                                        ]}>{t(`days.${dayKey}`)}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {isOneTime && (
                    <View style={styles.formGroup}>
                        <Text style={[styles.label, secondaryStyle, { fontFamily: fonts.bold }]}>{t('addLesson.date')}</Text>
                        {Platform.OS === 'web' ? (
                            <View style={[
                                styles.input,
                                {
                                    justifyContent: 'center',
                                    borderColor: colors.borderSubtle,
                                    backgroundColor: colors.surface,
                                    paddingVertical: 0,
                                    borderRadius: radius.large
                                }
                            ]}>
                                {React.createElement('input', {
                                    type: 'date',
                                    value: `${oneTimeDate.getFullYear()}-${(oneTimeDate.getMonth() + 1).toString().padStart(2, '0')}-${oneTimeDate.getDate().toString().padStart(2, '0')}`,
                                    onChange: (e: any) => {
                                        const [y, m, day] = e.target.value.split('-').map(Number);
                                        const newDate = new Date(oneTimeDate);
                                        newDate.setFullYear(y, m - 1, day);
                                        setOneTimeDate(newDate);
                                    },
                                    onClick: (e: any) => {
                                        try {
                                            if (e.target.showPicker) e.target.showPicker();
                                        } catch { }
                                    },
                                    style: {
                                        fontSize: 16,
                                        border: 'none',
                                        background: 'transparent',
                                        color: colors.textPrimary,
                                        width: '100%',
                                        height: '100%',
                                        outline: 'none',
                                        fontFamily: fonts.regular,
                                        cursor: 'pointer'
                                    }
                                })}
                            </View>
                        ) : (
                            <>
                                <TouchableOpacity
                                    activeOpacity={interaction.pressedOpacity}
                                    style={[
                                        styles.input,
                                        {
                                            justifyContent: 'center',
                                            borderColor: colors.borderSubtle,
                                            backgroundColor: colors.surface,
                                            borderRadius: radius.large
                                        }
                                    ]}
                                    onPress={() => setShowDatePicker(true)}
                                >
                                    <Text style={[textStyle, { fontSize: 16 }]}>{formatDateDMY(oneTimeDate)}</Text>
                                </TouchableOpacity>
                                {showDatePicker && (
                                    <DateTimePicker
                                        value={oneTimeDate}
                                        mode="date"
                                        display="default"
                                        onChange={(e, d) => {
                                            setShowDatePicker(Platform.OS === 'ios');
                                            if (d) setOneTimeDate(d);
                                        }}
                                    />
                                )}
                            </>
                        )}
                    </View>
                )}

                <View style={styles.formGroup}>
                    <Text style={[styles.label, secondaryStyle, { fontFamily: fonts.bold }]}>{t('addLesson.startTime')}</Text>
                    {Platform.OS === 'web' ? (
                        <View style={[
                            styles.input,
                            {
                                justifyContent: 'center',
                                borderColor: colors.borderSubtle,
                                backgroundColor: colors.surface,
                                paddingVertical: 0,
                                borderRadius: radius.large
                            }
                        ]}>
                            {React.createElement('input', {
                                type: 'time',
                                lang: 'en-GB',
                                value: `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`,
                                onChange: (e: any) => {
                                    const [h, m] = e.target.value.split(':');
                                    const d = new Date(startTime);
                                    d.setHours(Number(h));
                                    d.setMinutes(Number(m));
                                    d.setSeconds(0);
                                    onTimeChange(null, d);
                                },
                                onClick: (e: any) => {
                                    try {
                                        if (e.target.showPicker) e.target.showPicker();
                                    } catch (err) { }
                                },
                                style: {
                                    fontSize: 16,
                                    border: 'none',
                                    background: 'transparent',
                                    color: colors.textPrimary,
                                    width: '100%',
                                    height: '100%',
                                    outline: 'none',
                                    fontFamily: fonts.regular,
                                    cursor: 'pointer'
                                }
                            })}
                        </View>
                    ) : (
                        <>
                            <TouchableOpacity
                                activeOpacity={interaction.pressedOpacity}
                                style={[
                                    styles.input,
                                    {
                                        justifyContent: 'center',
                                        borderColor: colors.borderSubtle,
                                        backgroundColor: colors.surface,
                                        borderRadius: radius.large
                                    }
                                ]}
                                onPress={() => setShowTimePicker(true)}
                            >
                                <Text style={[textStyle, { fontSize: 16 }]}>
                                    {startTime.getHours().toString().padStart(2, '0')}:{startTime.getMinutes().toString().padStart(2, '0')}
                                </Text>
                            </TouchableOpacity>
                            {showTimePicker && (
                                <DateTimePicker
                                    value={startTime}
                                    mode="time"
                                    is24Hour={true}
                                    display="default"
                                    onChange={onTimeChange}
                                />
                            )}
                        </>
                    )}
                </View>

                <View style={styles.row}>
                    <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={[styles.label, secondaryStyle, { fontFamily: fonts.bold }]}>{t('addLesson.duration')}</Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    color: colors.textPrimary,
                                    borderColor: colors.borderSubtle,
                                    backgroundColor: colors.surface,
                                    fontFamily: fonts.regular,
                                    borderRadius: radius.large
                                }
                            ]}
                            value={duration}
                            onChangeText={setDuration}
                            keyboardType="numeric"
                            placeholder="1.5"
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>
                    <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={[styles.label, secondaryStyle, { fontFamily: fonts.bold }]}>{t('addLesson.distance')}</Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    color: colors.textPrimary,
                                    borderColor: colors.borderSubtle,
                                    backgroundColor: colors.surface,
                                    fontFamily: fonts.regular,
                                    borderRadius: radius.large
                                }
                            ]}
                            value={distance}
                            onChangeText={setDistance}
                            keyboardType="numeric"
                            placeholder="12.5"
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>
                </View>

                {isOneTime && (
                    <View style={styles.formGroup}>
                        <Text style={[styles.label, secondaryStyle, { fontFamily: fonts.bold }]}>{t('addLesson.notes')}</Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    color: colors.textPrimary,
                                    borderColor: colors.borderSubtle,
                                    backgroundColor: colors.surface,
                                    minHeight: 80,
                                    paddingVertical: 12,
                                    fontFamily: fonts.regular,
                                    borderRadius: radius.large
                                }
                            ]}
                            value={notes}
                            onChangeText={setNotes}
                            placeholder={t('addLesson.notesPlaceholder')}
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            textAlignVertical="top"
                        />
                    </View>
                )}

            </ScrollView>

            <View style={[
                styles.footer,
                {
                    borderTopColor: colors.borderSubtle,
                    backgroundColor: colors.surface,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: theme === 'light' ? 0.05 : 0.1,
                    shadowRadius: 10,
                    elevation: 5
                }
            ]}>
                <TouchableOpacity
                    activeOpacity={interaction.pressedOpacity}
                    style={[styles.saveButton, { backgroundColor: colors.accentPrimary, borderRadius: radius.large }, isSaving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={isSaving}
                >
                    <Text style={[styles.saveButtonText, { fontFamily: fonts.bold }]}>
                        {isSaving ? t('addLesson.saving') : (isOneTime ? t('addLesson.logOneTime') : (scheduleId ? t('addLesson.saveSchedule') : t('addLesson.saveSchedules')))}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
    },
    typeToggle: {
        flexDirection: 'row',
        marginBottom: 20,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#ccc',
    },
    toggleBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
    },
    toggleText: {
        fontWeight: '600',
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        marginBottom: 8,
        fontWeight: '600',
    },
    helper: {
        fontSize: 12,
        marginBottom: 8,
        fontStyle: 'italic',
    },
    input: {
        height: 50,
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 16,
        borderWidth: 1,
    },
    daysContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    dayChip: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        marginBottom: 4,
    },
    dayText: {
        fontSize: 14,
        fontWeight: '600',
    },
    row: {
        flexDirection: 'row',
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
    },
    saveButton: {
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
