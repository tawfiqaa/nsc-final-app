import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLesson } from '../src/contexts/LessonContext';
import { useTheme } from '../src/contexts/ThemeContext';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AddLessonScreen() {
    const router = useRouter();
    const { addSchedule, addOneTimeLog } = useLesson();
    const { colors } = useTheme();

    const [isOneTime, setIsOneTime] = useState(false);
    const [school, setSchool] = useState('');
    const [dayOfWeek, setDayOfWeek] = useState<number>(1); // Default Monday
    // For Multi-day support, we could use an array of selected days. 
    // The prompt asked: "option to make a school's lesson on multiple days".
    // Schedule interface currently supports single `dayOfWeek`.
    // We can either change Schedule to `days: number[]` or create multiple schedules.
    // Creating multiple schedules is easier for the backend logic (each has its own ID, can be edited/deleted individually).
    // Let's implement multi-select UI and create multiple schedules.
    const [selectedDays, setSelectedDays] = useState<number[]>([1]);

    const [startTime, setStartTime] = useState(new Date());
    const [duration, setDuration] = useState('');
    const [distance, setDistance] = useState('');
    const [initialCount, setInitialCount] = useState('');
    const [showTimePicker, setShowTimePicker] = useState(false);

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
            if (isOneTime) {
                // One Time Event
                await addOneTimeLog({
                    school: school.trim(),
                    status: 'present', // Default to present as it's an "event"
                    hours: dur,
                    distance: dist,
                    dateISO: new Date().toISOString(),
                    localDayKey: new Date().toISOString().split('T')[0],
                    isOneTime: true
                });
                Alert.alert('Success', 'One-time lesson logged.');
            } else {
                // Recurring Schedule(s)
                // Create one schedule per selected day
                const promises = selectedDays.map(day =>
                    addSchedule({
                        school: school.trim(),
                        dayOfWeek: day,
                        startTime: format(startTime, 'HH:mm'),
                        duration: dur,
                        distance: dist,
                        initialCount: initialCount ? parseInt(initialCount) : 0
                    })
                );
                await Promise.all(promises);
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

                <View style={styles.typeToggle}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, !isOneTime && { backgroundColor: colors.primary }]}
                        onPress={() => setIsOneTime(false)}
                    >
                        <Text style={[styles.toggleText, !isOneTime ? { color: '#fff' } : { color: colors.text }]}>Recurring</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, isOneTime && { backgroundColor: colors.primary }]}
                        onPress={() => setIsOneTime(true)}
                    >
                        <Text style={[styles.toggleText, isOneTime ? { color: '#fff' } : { color: colors.text }]}>One-Time</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: colors.secondaryText }]}>School Name</Text>
                    <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                        value={school}
                        onChangeText={setSchool}
                        placeholder="e.g. Lincoln High"
                        placeholderTextColor={colors.secondaryText}
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

                {!isOneTime && (
                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: colors.secondaryText }]}>Start Time</Text>
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
                    </View>
                )}

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

                {!isOneTime && (
                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: colors.secondaryText }]}>Initial Lesson Count (Optional)</Text>
                        <Text style={[styles.helper, { color: colors.secondaryText }]}>Already taught 5 lessons? Enter 5 here.</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                            value={initialCount}
                            onChangeText={setInitialCount}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={colors.secondaryText}
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
