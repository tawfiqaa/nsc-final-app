import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { useLesson } from '../src/contexts/LessonContext';
import { useOrg } from '../src/contexts/OrgContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { useFormatting } from '../src/utils/formatters';

const DAYS_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export default function EditLessonScreen() {
    const { t } = useTranslation();
    const { formatTime } = useFormatting();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { schedules, updateSchedule, deleteSchedule } = useLesson();
    const { user } = useAuth();
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

    const [school, setSchool] = useState('');
    const [dayOfWeek, setDayOfWeek] = useState<number>(1);
    const [startTime, setStartTime] = useState(new Date());
    const [duration, setDuration] = useState('');
    const [distance, setDistance] = useState('');
    const [showTimePicker, setShowTimePicker] = useState(false);

    useEffect(() => {
        if (id) {
            const schedule = schedules.find(s => s.id === id);
            if (schedule) {
                setSchool(schedule.school);
                setDayOfWeek(schedule.dayOfWeek);
                setDuration(schedule.duration.toString());
                setDistance(schedule.distance.toString());
                try {
                    const now = new Date();
                    const [hours, minutes] = schedule.startTime.split(':').map(Number);
                    now.setHours(hours, minutes, 0, 0);
                    setStartTime(now);
                } catch (e) {
                    console.error("Error parsing time", e);
                }
            }
        }
    }, [id, schedules]);

    const handleSave = async () => {
        if (!school.trim()) {
            Alert.alert(t('addLesson.validationError'), t('addLesson.schoolRequired'));
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
            if (!id) return;
            const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
            await updateSchedule(id, {
                school,
                dayOfWeek,
                startTime: timeStr,
                duration: dur,
                distance: dist,
            });
            router.back();
        } catch (error) {
            console.error(error);
            Alert.alert(t('common.error'), t('addLesson.saveFailed') || 'Failed');
        }
    };

    const handleDelete = async () => {
        Alert.alert(
            t('editLesson.deleteSchedule'),
            t('editLesson.deleteScheduleConfirm'),
            [
                { text: t('common.cancel'), style: "cancel" },
                {
                    text: t('common.delete'), style: "destructive", onPress: async () => {
                        try {
                            if (id) await deleteSchedule(id);
                            router.back();
                        } catch (error) {
                            console.error(error);
                            Alert.alert(t('common.error'), t('common.deleteFailed') || 'Delete failed');
                        }
                    }
                }
            ]
        )
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
                            }
                        ]}
                        value={school}
                        onChangeText={setSchool}
                        placeholder={t('addLesson.schoolPlaceholder')}
                        placeholderTextColor={colors.textSecondary}
                    />
                </View>

                <View style={styles.formGroup}>
                    <Text style={[styles.label, secondaryStyle, { fontFamily: fonts.bold }]}>{t('addLesson.daysOfWeek')}</Text>
                    <View style={styles.daysContainer}>
                        {DAYS_KEYS.map((dayKey, index) => (
                            <TouchableOpacity
                                activeOpacity={interaction.pressedOpacity}
                                key={dayKey}
                                style={[
                                    styles.dayChip,
                                    dayOfWeek === index ? { backgroundColor: colors.accentPrimary } : { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderWidth: 1 }
                                ]}
                                onPress={() => setDayOfWeek(index)}
                            >
                                <Text style={[
                                    styles.dayText,
                                    { fontFamily: fonts.bold },
                                    dayOfWeek === index ? { color: '#fff' } : { color: colors.textPrimary }
                                ]}>{t(`days.${dayKey}`)}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

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
                        />
                    </View>
                </View>

                <TouchableOpacity
                    activeOpacity={interaction.pressedOpacity}
                    style={[styles.deleteButton, { borderColor: colors.danger, borderRadius: radius.large }]}
                    onPress={handleDelete}
                >
                    <Text style={[styles.deleteText, { color: colors.danger, fontFamily: fonts.bold }]}>{t('editLesson.deleteSchedule')}</Text>
                </TouchableOpacity>

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
                    style={[styles.saveButton, { backgroundColor: colors.accentPrimary, borderRadius: radius.large }]}
                    onPress={handleSave}
                >
                    <Text style={[styles.saveButtonText, { fontFamily: fonts.bold }]}>{t('editLesson.updateSchedule')}</Text>
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
        paddingHorizontal: 16,
        paddingTop: 20,
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        marginBottom: 8,
        fontWeight: '600',
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
        paddingHorizontal: 16,
        paddingVertical: 20,
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
    deleteButton: {
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        marginTop: 20,
        marginBottom: 40,
    },
    deleteText: {
        fontSize: 16,
        fontWeight: '600',
    }
});
