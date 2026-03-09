import * as Calendar from 'expo-calendar';
import { Alert, Platform } from 'react-native';

export interface LessonCalendarData {
    title: string;       // e.g. "Lesson at Rabin High School"
    startDate: Date;
    endDate: Date;
    location?: string;   // Optional school address
    notes?: string;      // Optional lesson notes
}

/**
 * Returns the best default calendar ID for the current platform.
 * - iOS: prefers the "Default" source calendar
 * - Android: prefers 'LOCAL' source type
 */
async function getDefaultCalendarId(): Promise<string | null> {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

    if (Platform.OS === 'ios') {
        // Pick the default iOS calendar (usually iCloud or Local)
        const defaultCal = calendars.find(
            (c) => c.source?.name === 'Default' || c.source?.type === Calendar.SourceType.LOCAL
        );
        return defaultCal?.id ?? calendars[0]?.id ?? null;
    }

    // Android: prefer a writable LOCAL calendar
    const localCal = calendars.find(
        (c) =>
            c.allowsModifications &&
            (c.source?.type === Calendar.SourceType.LOCAL ||
                c.accessLevel === Calendar.CalendarAccessLevel.OWNER ||
                c.accessLevel === Calendar.CalendarAccessLevel.ROOT)
    );
    return localCal?.id ?? calendars.find((c) => c.allowsModifications)?.id ?? null;
}

/**
 * Syncs a lesson to the device's native calendar.
 * Requests permissions, finds the best available calendar, and creates an event.
 *
 * @returns The created event ID, or null if the operation was cancelled/failed.
 */
export async function syncLessonToCalendar(lesson: LessonCalendarData): Promise<string | null> {
    // 1. Request permissions
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
        Alert.alert(
            'Calendar Permission Required',
            'Please allow calendar access in your device settings to sync lessons.'
        );
        return null;
    }

    // 2. Find the default calendar
    const calendarId = await getDefaultCalendarId();
    if (!calendarId) {
        Alert.alert('No Calendar Found', 'Could not find a writable calendar on your device.');
        return null;
    }

    // 3. Create the event
    try {
        const eventId = await Calendar.createEventAsync(calendarId, {
            title: lesson.title,
            startDate: lesson.startDate,
            endDate: lesson.endDate,
            location: lesson.location,
            notes: lesson.notes,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            alarms: [{ relativeOffset: -30 }], // 30-min reminder
        });

        return eventId;
    } catch (error: any) {
        console.error('[calendarSync] Failed to create event:', error);
        Alert.alert('Calendar Sync Failed', error?.message || 'Could not add lesson to calendar.');
        return null;
    }
}
