import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { AttendanceLog } from '../types';

interface LogCardProps {
    log: AttendanceLog;
    onDelete?: () => void;
    onEditNote?: () => void;
    readOnly?: boolean;
    deleteType?: 'text' | 'icon';
}

export const LogCard: React.FC<LogCardProps> = ({ log, onDelete, onEditNote, readOnly, deleteType = 'text' }) => {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useRouter();
    const isPresent = log.status === 'present';

    return (
        <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.text }]}>
            <View style={styles.row}>
                <View style={styles.info}>
                    <Text style={[styles.school, { color: colors.text }]}>{log.school}</Text>
                    <Text style={[styles.date, { color: colors.secondaryText }]}>
                        {format(new Date(log.dateISO), 'MMM d, h:mm a')}
                    </Text>
                </View>

                <View style={styles.statusContainer}>
                    <Ionicons
                        name={isPresent ? "checkmark-circle" : "close-circle"}
                        size={24}
                        color={isPresent ? colors.success : colors.error}
                    />
                    <Text style={[styles.status, { color: isPresent ? colors.success : colors.error }]}>
                        {isPresent ? 'Present' : 'Absent'}
                    </Text>
                </View>
            </View>

            {log.notes ? (
                <View style={styles.notesContainer}>
                    <Ionicons name="document-text-outline" size={14} color={colors.secondaryText} />
                    <Text style={[styles.notesText, { color: colors.secondaryText }]}>{log.notes}</Text>
                </View>
            ) : null}

            {!readOnly && (
                <View style={styles.actions}>
                    <TouchableOpacity onPress={onDelete}>
                        {deleteType === 'icon' ? (
                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                        ) : (
                            <Text style={[styles.actionLink, { color: colors.error }]}>
                                Undo
                            </Text>
                        )}
                    </TouchableOpacity>
                    {user?.migratedToV2 && (
                        <TouchableOpacity onPress={() => router.push({ pathname: '/lesson/[id]' as any, params: { id: log.id } })}>
                            <Text style={[styles.actionLink, { color: colors.text }]}>Attendance</Text>
                        </TouchableOpacity>
                    )}
                    {onEditNote && (
                        <TouchableOpacity onPress={onEditNote}>
                            <Text style={[styles.actionLink, { color: colors.primary }]}>
                                {log.notes ? 'Edit Note' : 'Add Note'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        elevation: 1,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        borderLeftWidth: 4,
        borderLeftColor: 'transparent', // can be dynamic
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    info: {
        flex: 1,
    },
    school: {
        fontSize: 16,
        fontWeight: '600',
    },
    date: {
        fontSize: 12,
        marginTop: 2,
    },
    statusContainer: {
        alignItems: 'flex-end',
    },
    status: {
        fontSize: 12,
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
        marginTop: 8,
        justifyContent: 'flex-end',
        gap: 16,
    },
    actionLink: {
        fontSize: 12,
        fontWeight: '600',
    },
    notesContainer: {
        flexDirection: 'row',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#ccc',
        alignItems: 'flex-start',
    },
    notesText: {
        fontSize: 13,
        marginLeft: 6,
        flex: 1,
        fontStyle: 'italic',
    },
});
