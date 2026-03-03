import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface SectionContainerProps {
    title: string;
    subtitle?: string;
    rightAction?: React.ReactNode;
    children: React.ReactNode;
}

export const SectionContainer: React.FC<SectionContainerProps> = ({
    title,
    subtitle,
    rightAction,
    children
}) => {
    const { colors, fonts, tokens, theme } = useTheme();
    const { radius } = tokens;

    return (
        <View style={[
            styles.container,
            {
                backgroundColor: colors.surface,
                borderRadius: radius.large,
                borderColor: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
                borderWidth: 1,
            }
        ]}>
            {/* Left Accent Indicator */}
            <View style={[
                styles.accentBar,
                {
                    backgroundColor: colors.accentPrimary,
                    opacity: 0.4
                }
            ]} />

            <View style={[styles.headerTint, { backgroundColor: colors.accentPrimary, opacity: 0.05 }]} />

            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={styles.titleContainer}>
                        <Text style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.bold }]}>
                            {title}
                        </Text>
                        {subtitle ? (
                            <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                                {subtitle}
                            </Text>
                        ) : null}
                    </View>
                    {rightAction && (
                        <View style={styles.rightAction}>
                            {rightAction}
                        </View>
                    )}
                </View>

                <View style={[styles.divider, { backgroundColor: colors.divider }]} />

                <View style={styles.children}>
                    {children}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
        overflow: 'hidden',
        position: 'relative',
        // Subtle shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    accentBar: {
        position: 'absolute',
        top: 16,
        bottom: 16,
        left: 0,
        width: 3,
        borderTopRightRadius: 2,
        borderBottomRightRadius: 2,
    },
    headerTint: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60, // Approximate header height
    },
    content: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingLeft: 4, // Space for accent bar
    },
    titleContainer: {
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
    },
    subtitle: {
        fontSize: 13,
        marginTop: 2,
    },
    rightAction: {
        marginLeft: 12,
    },
    divider: {
        height: 1,
        width: '100%',
        marginBottom: 16,
    },
    children: {
        width: '100%',
    }
});
