// The project model. Every later slice and the exported file format (S-03)
// build on it. START and FINISH are distinct entities, never Tasks, so no Task
// can reference them: a Task's predecessors hold Task ids only.

/** Positive integer, assigned sequentially from 1, never reused within a project. */
export type TaskId = number;

export type TaskStatus = "to-do" | "in-progress" | "done";

export type DayCountingMode = "calendar-days" | "weekdays";

export interface Task {
  id: TaskId;
  /** Trimmed, 1..200 UTF-16 code units (`.length`, as `maxLength` counts), well-formed Unicode. */
  name: string;
  /** Task ids only, no duplicates, ascending id order. */
  predecessors: TaskId[];
  /** Whole days; set from S-04. */
  duration?: number;
  /** "to-do" on creation; set from S-07. */
  status: TaskStatus;
  /** ISO yyyy-mm-dd; set from S-07. */
  completionDate?: string;
}

export interface Start {
  /** ISO yyyy-mm-dd; set from S-04. */
  date?: string;
}

/** Placeholder for future FINISH attributes. */
export type Finish = Record<string, never>;

export interface Project {
  /** Set from S-03. */
  name?: string;
  start: Start;
  finish: Finish;
  /** "calendar-days" by default; set from S-06. */
  dayCountingMode: DayCountingMode;
  /** The id the next created Task gets. */
  nextTaskId: TaskId;
  /** Creation order. */
  tasks: Task[];
}
