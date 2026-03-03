import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { AttendanceLog } from '../types';
import { useFormatting } from '../utils/formatters';

interface LogCardProps {
    log: AttendanceLog;
    onDelete?: () => void;
    onEditNote?: () => void;
    readOnly?: boolean;
    deleteType?: 'text' | 'icon';
}

export const LogCard: React.FC<LogCardProps> = ({ log, onDelete, onEditNote, readOnly, deleteType = 'text' }) => {
    const { colors, fonts } = useTheme();
    const { user } = useAuth();
    const { t } = useTranslation();
    const { formatDate } = useFormatting();
    const router = useRouter();
    const isPresent = log.status === 'present';

    const textStyle = { fontFamily: fonts.regular, color: colors.text };
    const boldStyle = { fontFamily: fonts.bold, color: colors.text };
    const secondaryStyle = { fontFamily: fonts.regular, color: colors.secondaryText };

    return (
        <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.text }]}>
            <View style={styles.row}>
                <View style={styles.info}>
                    <Text style={[styles.school, boldStyle]}>{log.school}</Text>
                    <Text style={[styles.date, secondaryStyle]}>
                        {formatDate(new Date(log.dateISO), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>

                <View style={styles.statusContainer}>
                    <Ionicons
                        name={isPresent ? "checkmark-circle" : "close-circle"}
                        size={24}
                        color={isPresent ? colors.success : colors.error}
                    />
                    <Text style={[styles.status, { color: isPresent ? colors.success : colors.error, fontFamily: fonts.bold }]}>
                        {isPresent ? t('logCard.present') : t('logCard.absent')}
                    </Text>
                </View>
            </View>

            {log.notes ? (
                <View style={styles.notesContainer}>
                    <Ionicons name="document-text-outline" size={14} color={colors.secondaryText} />
                    <Text style={[styles.notesText, secondaryStyle]}>{log.notes}</Text>
                </View>
            ) : null}

            <View style={styles.actions}>
                {!readOnly && (
                    <TouchableOpacity onPress={onDelete}>
                        {deleteType === 'icon' ? (
                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                        ) : (
                            <Text style={[styles.actionLink, { color: colors.error, fontFamily: fonts.bold }]}>
                                {t('logCard.undo')}
                            </Text>
                        )}
                    </TouchableOpacity>
                )}
                {(user?.migratedToV2 || !!log.createdBy) && (
                    <TouchableOpacity onPress={() => router.push({ pathname: '/lesson/[id]' as any, params: { id: log.id } })}>
                        <Text style={[styles.actionLink, boldStyle]}>{t('logCard.attendance')}</Text>
                    </TouchableOpacity>
                )}
                {!readOnly && onEditNote && (
                    <TouchableOpacity onPress={onEditNote}>
                        <Text style={[styles.actionLink, { color: colors.primary, fontFamily: fonts.bold }]}>
                            {log.notes ? t('dashboard.editNote') : t('dashboard.addNote')}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
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
        borderLeftColor: 'transparent',
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
