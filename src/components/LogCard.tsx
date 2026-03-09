import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { AttendanceLog } from '../types';
import { formatDateDMY, formatTime24 } from '../utils/datetime';

interface LogCardProps {
    log: AttendanceLog;
    onDelete?: () => void;
    onEditNote?: () => void;
    readOnly?: boolean;
}

export const LogCard: React.FC<LogCardProps> = ({ log, onDelete, onEditNote, readOnly }) => {
    const { colors, fonts, tokens, theme } = useTheme();
    const { radius, interaction } = tokens;
    const { user } = useAuth();
    const { t } = useTranslation();
    const router = useRouter();
    const isPresent = log.status === 'present';

    const textStyle = { fontFamily: fonts.regular, color: colors.textPrimary };
    const boldStyle = { fontFamily: fonts.bold, color: colors.textPrimary };
    const secondaryStyle = { fontFamily: fonts.regular, color: colors.textSecondary };

    const cardStyle = [
        styles.card,
        {
            backgroundColor: colors.surface,
            borderRadius: radius.medium,
            borderColor: theme === 'light' ? colors.borderSubtle : colors.divider,
            borderWidth: 1,
            // Subtle shadow for light mode
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: theme === 'light' ? 0.05 : 0.1,
            shadowRadius: 10,
            elevation: theme === 'light' ? 2 : 4,
            borderLeftColor: isPresent ? colors.success : colors.danger,
        }
    ];

    return (
        <View style={cardStyle}>
            <View style={styles.row}>
                <View style={styles.info}>
                    <Text style={[styles.school, boldStyle]}>{log.school}</Text>
                    <Text style={[styles.date, secondaryStyle]}>
                        {formatDateDMY(new Date(log.dateISO))} {formatTime24(new Date(log.dateISO))}
                    </Text>
                </View>

                <View style={styles.statusContainer}>
                    <Ionicons
                        name={isPresent ? "checkmark-circle" : "close-circle"}
                        size={24}
                        color={isPresent ? colors.success : colors.danger}
                    />
                    <Text style={[styles.status, { color: isPresent ? colors.success : colors.danger, fontFamily: fonts.bold }]}>
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
                {!readOnly && onDelete && (
                    <TouchableOpacity
                        activeOpacity={interaction.pressedOpacity}
                        onPress={() => {
                            if (Platform.OS === 'web') {
                                if (window.confirm('Are you sure you want to delete this record?')) {
                                    onDelete();
                                }
                            } else {
                                Alert.alert(
                                    'Delete Record',
                                    'Are you sure you want to delete this?',
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Delete', style: 'destructive', onPress: onDelete }
                                    ]
                                );
                            }
                        }}
                    >
                        <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </TouchableOpacity>
                )}
                {(user?.migratedToV2 || !!log.createdBy) && (
                    <TouchableOpacity activeOpacity={interaction.pressedOpacity} onPress={() => router.push({ pathname: '/lesson/[id]' as any, params: { id: log.id } })}>
                        <Text style={[styles.actionLink, boldStyle]}>{t('logCard.attendance')}</Text>
                    </TouchableOpacity>
                )}
                {!readOnly && onEditNote && (
                    <TouchableOpacity activeOpacity={interaction.pressedOpacity} onPress={onEditNote}>
                        <Text style={[styles.actionLink, { color: colors.accentPrimary, fontFamily: fonts.bold }]}>
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
        borderTopColor: 'rgba(148, 163, 184, 0.2)',
        alignItems: 'flex-start',
    },
    notesText: {
        fontSize: 13,
        marginLeft: 6,
        flex: 1,
        fontStyle: 'italic',
    },
});
