export interface Student {
    id: string; // Document ID (UUID or generated)
    fullName: string;
    isActive: boolean; // Default true
    createdAt: number;
    notes?: string;
}

export type AttendanceRecordStatus = 'unmarked' | 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
    id: string; // Maps to studentId
    status: AttendanceRecordStatus;
    note?: string;
    markedAt?: number | any; // serverTimestamp or numeric
    updatedAt: number;
}

export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'pending';

export type OrgRole = 'owner' | 'admin' | 'teacher';
export type MembershipStatus = 'pending' | 'approved' | 'rejected';

export interface Organization {
    id: string;
    name: string;
    createdAt: any;
    createdBy: string;
    joinCode: string;
    isActive: boolean;
}

export interface OrgMembership {
    uid: string;
    role: OrgRole;
    status: MembershipStatus;
    requestedAt: any;
    approvedAt?: any;
    approvedBy?: string;
    updatedAt: any;
    displayName?: string;
    email?: string;
}

export interface UserOrgMembership {
    orgId: string;
    orgName?: string;
    role: OrgRole;
    status: MembershipStatus;
    requestedAt: any;
    updatedAt: any;
}

export interface OrgContextType {
    activeOrg: Organization | null;
    activeOrgId: string | null;
    membershipStatus: MembershipStatus | null;
    membershipRole: OrgRole | null;
    userOrgs: UserOrgMembership[];
    orgLoading: boolean;
    createOrg: (name: string) => Promise<string>;
    joinOrg: (orgIdOrCode: string) => Promise<void>;
    switchOrg: (orgId: string) => Promise<void>;
}

export interface User {
    uid: string;
    email: string;
    name?: string;
    role: UserRole;
    isApproved: boolean;
    activeOrgId?: string;
    isSuperAdmin?: boolean;
    migratedToV2?: boolean;
    migrationVersion?: number;
    migratedAt?: any;
    createdAt: number;
    updatedAt: number;
    settings?: {
        ui?: {
            language?: string;
        };
    };
}

export interface School {
    id: string;
    name: string;
    gallery?: string[];
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
    isActive?: boolean; // Default true if undefined
    createdAt: number;
    updatedAt: number;
    createdBy?: string;
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
    notes?: string;
    createdAt: number;
    updatedAt: number;
    createdBy?: string;
}

export interface TeacherData {
    ownerUid: string;
    schedules: Schedule[];
    attendanceLogs: AttendanceLog[];
    schoolGalleries?: Record<string, string[]>;
    updatedAt: number;
}

export interface PayrollSettings {
    hourlyRate: number;
    kmRate: number;
    currency: string; // default "ILS"
    updatedAt?: any; // serverTimestamp
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
    loginWithGoogle: (idToken: string) => Promise<void>;
    register: (email: string, password: string, name?: string) => Promise<void>;
    logout: () => Promise<void>;
}

export interface LessonContextType {
    schedules: Schedule[];
    logs: AttendanceLog[];
    schoolGalleries: Record<string, string[]>;
    loading: boolean;
    addSchedule: (schedule: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    addSchedules: (schedules: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<void>;
    updateSchedule: (id: string, updates: Partial<Schedule>) => Promise<void>;
    deleteSchedule: (id: string) => Promise<void>;
    markAttendance: (schedule: Schedule, status: AttendanceStatus, dateISO: string, notes?: string) => Promise<void>;
    addOneTimeLog: (log: Omit<AttendanceLog, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    toggleLogStatus: (logId: string) => Promise<void>;
    updateLogNotes: (logId: string, notes: string) => Promise<void>;
    deleteLog: (logId: string) => Promise<void>;
    deleteStudent: (schoolId: string, studentId: string) => Promise<void>;
    deleteSchool: (schoolName: string) => Promise<void>;
    addSchoolPhoto: (schoolName: string, localUri: string) => Promise<void>;
    deleteSchoolPhoto: (schoolName: string, photoUrl: string) => Promise<void>;
    refresh: () => Promise<void>;
    setTargetUid: (uid: string) => void;
    saveAttendance: (lessonId: string, records: AttendanceRecord[]) => Promise<void>;
}
