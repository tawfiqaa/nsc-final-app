import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLesson } from '../src/contexts/LessonContext';
import { useTheme } from '../src/contexts/ThemeContext';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function EditLessonScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { schedules, updateSchedule, deleteSchedule } = useLesson();
    const { colors } = useTheme();

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
                // Parse time "HH:mm"
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
            if (!id) return;
            await updateSchedule(id, {
                school,
                dayOfWeek,
                startTime: format(startTime, 'HH:mm'),
                duration: dur,
                distance: dist,
            });
            router.back();
        } catch (e) {
            Alert.alert('Error', 'Failed to update lesson');
        }
    };

    const handleDelete = async () => {
        Alert.alert(
            "Delete Schedule",
            "Are you sure you want to delete this schedule?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete", style: "destructive", onPress: async () => {
                        try {
                            if (id) await deleteSchedule(id);
                            router.back();
                        } catch (e) {
                            Alert.alert("Error", "Failed to delete");
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

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.content}>

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

                <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: colors.secondaryText }]}>Day of Week</Text>
                    <View style={styles.daysContainer}>
                        {DAYS.map((day, index) => (
                            <TouchableOpacity
                                key={day}
                                style={[
                                    styles.dayChip,
                                    dayOfWeek === index ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }
                                ]}
                                onPress={() => setDayOfWeek(index)}
                            >
                                <Text style={[
                                    styles.dayText,
                                    dayOfWeek === index ? { color: '#fff' } : { color: colors.text }
                                ]}>{day}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: colors.secondaryText }]}>Start Time</Text>
                    {Platform.OS === 'web' ? (
                        <View style={[styles.input, { justifyContent: 'center', borderColor: colors.border, backgroundColor: colors.card, paddingVertical: 0 }]}>
                            {React.createElement('input', {
                                type: 'time',
                                lang: 'en-GB', // Forces 24-hour format in supported browsers
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
                        />
                    </View>
                    <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={[styles.label, { color: colors.secondaryText }]}>Distance (km)</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                            value={distance}
                            onChangeText={setDistance}
                            keyboardType="numeric"
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.deleteButton, { borderColor: colors.error }]}
                    onPress={handleDelete}
                >
                    <Text style={[styles.deleteText, { color: colors.error }]}>Delete Schedule</Text>
                </TouchableOpacity>

            </ScrollView>

            <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
                <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.primary }]}
                    onPress={handleSave}
                >
                    <Text style={styles.saveButtonText}>Update Schedule</Text>
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
