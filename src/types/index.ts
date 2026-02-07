export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'pending';

export interface User {
    uid: string;
    email: string;
    name?: string;
    role: UserRole;
    isApproved: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface Schedule {
    id: string;
    school: string;
    dayOfWeek: number; // 0=Sun ... 6=Sat
    startTime: string; // "HH:mm"
    duration: number; // hours (decimals allowed)
    distance: number; // km
    initialCount?: number;
    createdAt: number;
    updatedAt: number;
}

export type AttendanceStatus = 'present' | 'absent';

export interface AttendanceLog {
    id: string;
    scheduleId?: string; // absent for one-time logs
    school: string;      // always stored for filtering
    startTime?: string;  // optional for one-time logs
    dateISO: string;     // intended lesson date-time ISO
    localDayKey: string; // "yyyy-MM-dd" computed in device local time when created
    status: AttendanceStatus;
    hours: number;       // 0 if absent else duration
    distance: number;    // 0 if absent else distance
    isOneTime?: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface TeacherData {
    ownerUid: string;
    schedules: Schedule[];
    attendanceLogs: AttendanceLog[];
    updatedAt: number;
}

export interface ThemeContextType {
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    colors: {
        background: string;
        card: string;
        text: string;
        secondaryText: string;
        primary: string;
    };
}

export interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name?: string) => Promise<void>;
    logout: () => Promise<void>;
}

export interface LessonContextType {
    schedules: Schedule[];
    logs: AttendanceLog[];
    loading: boolean;
    addSchedule: (schedule: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateSchedule: (id: string, updates: Partial<Schedule>) => Promise<void>;
    deleteSchedule: (id: string) => Promise<void>;
    markAttendance: (schedule: Schedule, status: AttendanceStatus, dateISO: string) => Promise<void>;
    addOneTimeLog: (log: Omit<AttendanceLog, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    toggleLogStatus: (logId: string) => Promise<void>;
    deleteLog: (logId: string) => Promise<void>;
    refresh: () => Promise<void>;
    setTargetUid: (uid: string) => void;
}
