import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLesson } from '../src/contexts/LessonContext';
import { useTheme } from '../src/contexts/ThemeContext';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AddLessonScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const scheduleId = typeof params.scheduleId === 'string' ? params.scheduleId : undefined;
    const schoolParam = typeof params.school === 'string' ? params.school : undefined;
    const modeParam = typeof params.mode === 'string' ? params.mode : undefined;

    const { addSchedule, addSchedules, addOneTimeLog, updateSchedule, schedules } = useLesson();
    const { colors } = useTheme();

    const [isOneTime, setIsOneTime] = useState(false);
    const [school, setSchool] = useState('');
    const [selectedDays, setSelectedDays] = useState<number[]>([]);

    const isContextMode = !!(schoolParam && modeParam === 'log');

    useEffect(() => {
        if (scheduleId) {
            const sched = schedules.find(s => s.id === scheduleId);
            if (sched) {
                setSchool(sched.school);
                setSelectedDays([sched.dayOfWeek]);
                const [h, m] = sched.startTime.split(':').map(Number);
                const d = new Date();
                d.setHours(h);
                d.setMinutes(m);
                setStartTime(d);
                setDuration(sched.duration.toString());
                setDistance(sched.distance.toString());
                setIsOneTime(false);
            }
        } else if (schoolParam) {
            setSchool(schoolParam);
            if (modeParam === 'log') {
                setIsOneTime(true);
            }
        }
    }, [scheduleId, schedules, schoolParam, modeParam]);

    const [startTime, setStartTime] = useState(new Date());
    const [oneTimeDate, setOneTimeDate] = useState(new Date());
    const [duration, setDuration] = useState('');
    const [distance, setDistance] = useState('');
    const [initialCount, setInitialCount] = useState('');
    const [notes, setNotes] = useState('');
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

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
        if (!school.trim()) {
            Alert.alert('Validation Error', 'School name is required');
            return;
        }
        if (!isOneTime && selectedDays.length === 0) {
            Alert.alert('Validation Error', 'Please select at least one day.');
            return;
        }
        const dur = parseFloat(duration);
        if (isNaN(dur) || dur <= 0) {
            Alert.alert('Validation Error', 'Duration must be greater than 0');
            return;
        }
        const dist = parseFloat(distance);
        if (isNaN(dist) || dist < 0) {
            Alert.alert('Validation Error', 'Distance must be valid');
            return;
        }

        try {
            if (scheduleId) {
                // Update Existing Schedule
                // We only update the single schedule being edited.
                // If user selected multiple days, we take the first one or warn?
                // Let's assume user changes day by selecting ONE day.
                const day = selectedDays[0];
                await updateSchedule(scheduleId, {
                    school: school.trim(),
                    dayOfWeek: day,
                    startTime: format(startTime, 'HH:mm'),
                    duration: dur,
                    distance: dist,
                    isActive: true // Revive if archived
                });
                Alert.alert('Success', 'Schedule updated.');
            } else if (isOneTime) {
                // One Time Event
                await addOneTimeLog({
                    school: school.trim(),
                    status: 'present',
                    hours: dur,
                    distance: dist,
                    dateISO: oneTimeDate.toISOString(),
                    localDayKey: format(oneTimeDate, 'yyyy-MM-dd'),
                    notes: notes.trim() ? notes.trim() : undefined,
                    isOneTime: true
                });
                Alert.alert('Success', 'One-time lesson logged.');
            } else {
                // Recurring Schedule(s)
                const newSchedules = selectedDays.map(day => ({
                    school: school.trim(),
                    dayOfWeek: day,
                    startTime: format(startTime, 'HH:mm'),
                    duration: dur,
                    distance: dist,
                }));
                await addSchedules(newSchedules);
                Alert.alert('Success', `Saved ${selectedDays.length} schedule(s).`);
            }
            router.back();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to add lesson');
        }
    };

    const onTimeChange = (event: any, selectedDate?: Date) => {
        setShowTimePicker(Platform.OS === 'ios');
        if (selectedDate) {
            setStartTime(selectedDate);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.content}>

                {!isContextMode && (
                    <View style={styles.typeToggle}>
                        <TouchableOpacity
                            style={[styles.toggleBtn, !isOneTime && { backgroundColor: colors.primary }, scheduleId && { opacity: 0.5 }]}
                            onPress={() => !scheduleId && setIsOneTime(false)}
                            disabled={!!scheduleId}
                        >
                            <Text style={[styles.toggleText, !isOneTime ? { color: '#fff' } : { color: colors.text }]}>
                                {scheduleId ? 'Editing Schedule' : 'Recurring'}
                            </Text>
                        </TouchableOpacity>
                        {!scheduleId && (
                            <TouchableOpacity
                                style={[styles.toggleBtn, isOneTime && { backgroundColor: colors.primary }]}
                                onPress={() => setIsOneTime(true)}
                            >
                                <Text style={[styles.toggleText, isOneTime ? { color: '#fff' } : { color: colors.text }]}>One-Time</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: colors.secondaryText }]}>School Name</Text>
                    <TextInput
                        style={[
                            styles.input,
                            { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
                            isContextMode && { opacity: 0.6 }
                        ]}
                        value={school}
                        onChangeText={setSchool}
                        placeholder="e.g. Lincoln High"
                        placeholderTextColor={colors.secondaryText}
                        editable={!isContextMode}
                    />
                </View>

                {!isOneTime && (
                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: colors.secondaryText }]}>Days of Week</Text>
                        <Text style={[styles.helper, { color: colors.secondaryText }]}>Select all days that apply.</Text>
                        <View style={styles.daysContainer}>
                            {DAYS.map((day, index) => {
                                const isSelected = selectedDays.includes(index);
                                return (
                                    <TouchableOpacity
                                        key={day}
                                        style={[
                                            styles.dayChip,
                                            isSelected ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }
                                        ]}
                                        onPress={() => toggleDay(index)}
                                    >
                                        <Text style={[
                                            styles.dayText,
                                            isSelected ? { color: '#fff' } : { color: colors.text }
                                        ]}>{day}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {isOneTime && (
                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: colors.secondaryText }]}>Date</Text>
                        {Platform.OS === 'web' ? (
                            <View style={[styles.input, { justifyContent: 'center', borderColor: colors.border, backgroundColor: colors.card, paddingVertical: 0 }]}>
                                {React.createElement('input', {
                                    type: 'date',
                                    value: format(oneTimeDate, 'yyyy-MM-dd'),
                                    onChange: (e: any) => {
                                        const d = new Date(e.target.value);
                                        // maintain time if needed, but for date picking usually reset or keep? 
                                        // user picks date. standard is start of day or maintain current time? 
                                        // let's just set the date part. props.oneTimeDate has some time.
                                        // simple new Date(str) is UTC usually or local?
                                        // 'yyyy-MM-dd' + 'T00:00:00'
                                        if (!isNaN(d.getTime())) {
                                            // Fix timezone offset issue manually or use date-fns parse?
                                            // simple:
                                            const [y, m, day] = e.target.value.split('-').map(Number);
                                            const newDate = new Date(oneTimeDate);
                                            newDate.setFullYear(y, m - 1, day);
                                            setOneTimeDate(newDate);
                                        }
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
                                        color: colors.text,
                                        width: '100%',
                                        height: '100%',
                                        outline: 'none',
                                        fontFamily: 'inherit',
                                        cursor: 'pointer'
                                    }
                                })}
                            </View>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={[styles.input, { justifyContent: 'center', borderColor: colors.border, backgroundColor: colors.card }]}
                                    onPress={() => setShowDatePicker(true)}
                                >
                                    <Text style={{ color: colors.text, fontSize: 16 }}>{format(oneTimeDate, 'MMM dd, yyyy')}</Text>
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
                    <Text style={[styles.label, { color: colors.secondaryText }]}>Start Time</Text>
                    {Platform.OS === 'web' ? (
                        <View style={[styles.input, { justifyContent: 'center', borderColor: colors.border, backgroundColor: colors.card, paddingVertical: 0 }]}>
                            {React.createElement('input', {
                                type: 'time',
                                value: format(startTime, 'HH:mm'),
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
                                    } catch (err) {
                                        console.log('showPicker not supported', err);
                                    }
                                },
                                style: {
                                    fontSize: 16,
                                    border: 'none',
                                    background: 'transparent',
                                    color: colors.text,
                                    width: '100%',
                                    height: '100%',
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                    cursor: 'pointer'
                                }
                            })}
                        </View>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[styles.input, { justifyContent: 'center', borderColor: colors.border, backgroundColor: colors.card }]}
                                onPress={() => setShowTimePicker(true)}
                            >
                                <Text style={{ color: colors.text, fontSize: 16 }}>{format(startTime, 'HH:mm')}</Text>
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
                        <Text style={[styles.label, { color: colors.secondaryText }]}>Duration (hrs)</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                            value={duration}
                            onChangeText={setDuration}
                            keyboardType="numeric"
                            placeholder="1.5"
                            placeholderTextColor={colors.secondaryText}
                        />
                    </View>
                    <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={[styles.label, { color: colors.secondaryText }]}>Distance (km)</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                            value={distance}
                            onChangeText={setDistance}
                            keyboardType="numeric"
                            placeholder="12.5"
                            placeholderTextColor={colors.secondaryText}
                        />
                    </View>
                </View>

                {isOneTime && (
                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: colors.secondaryText }]}>Notes (Optional)</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card, minHeight: 80, paddingVertical: 12 }]}
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="e.g. Covered Chapter 4"
                            placeholderTextColor={colors.secondaryText}
                            multiline
                            textAlignVertical="top"
                        />
                    </View>
                )}



            </ScrollView>

            <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
                <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.primary }]}
                    onPress={handleSave}
                >
                    <Text style={styles.saveButtonText}>{isOneTime ? 'Log One-Time Lesson' : 'Save Schedule(s)'}</Text>
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
