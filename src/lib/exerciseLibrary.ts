export interface LibraryExercise {
  name: string
  sets: number
  reps: number
  rest: number
  timed: boolean // true = reps são segundos (mobilidade/alongamento)
}

export interface LibraryGroup {
  key: string
  label: string
  exercises: LibraryExercise[]
}

export const EXERCISE_LIBRARY: LibraryGroup[] = [
  {
    key: 'peito',
    label: 'Peito',
    exercises: [
      { name: 'Supino reto com barra', sets: 4, reps: 10, rest: 90, timed: false },
      { name: 'Supino inclinado com halteres', sets: 4, reps: 10, rest: 90, timed: false },
      { name: 'Supino declinado', sets: 3, reps: 12, rest: 90, timed: false },
      { name: 'Crucifixo com halteres', sets: 3, reps: 12, rest: 60, timed: false },
      { name: 'Fly na máquina', sets: 3, reps: 15, rest: 60, timed: false },
      { name: 'Crossover no cabo', sets: 3, reps: 15, rest: 60, timed: false },
      { name: 'Flexão de braço', sets: 3, reps: 15, rest: 60, timed: false },
      { name: 'Supino com halteres', sets: 4, reps: 10, rest: 90, timed: false },
    ],
  },
  {
    key: 'costas',
    label: 'Costas',
    exercises: [
      { name: 'Puxada frontal', sets: 4, reps: 10, rest: 90, timed: false },
      { name: 'Remada curvada com barra', sets: 4, reps: 10, rest: 90, timed: false },
      { name: 'Remada unilateral com halter', sets: 3, reps: 12, rest: 60, timed: false },
      { name: 'Puxada neutra', sets: 3, reps: 12, rest: 90, timed: false },
      { name: 'Levantamento terra', sets: 4, reps: 8, rest: 120, timed: false },
      { name: 'Hiperextensão', sets: 3, reps: 15, rest: 60, timed: false },
      { name: 'Pullover com halter', sets: 3, reps: 12, rest: 60, timed: false },
      { name: 'Remada baixa no cabo', sets: 3, reps: 12, rest: 90, timed: false },
    ],
  },
  {
    key: 'pernas',
    label: 'Pernas',
    exercises: [
      { name: 'Agachamento livre', sets: 4, reps: 10, rest: 120, timed: false },
      { name: 'Leg press 45°', sets: 4, reps: 12, rest: 90, timed: false },
      { name: 'Cadeira extensora', sets: 3, reps: 15, rest: 60, timed: false },
      { name: 'Mesa flexora', sets: 3, reps: 15, rest: 60, timed: false },
      { name: 'Stiff com halteres', sets: 3, reps: 12, rest: 90, timed: false },
      { name: 'Avanço com halteres', sets: 3, reps: 12, rest: 60, timed: false },
      { name: 'Panturrilha em pé', sets: 4, reps: 20, rest: 45, timed: false },
      { name: 'Agachamento sumô', sets: 3, reps: 12, rest: 90, timed: false },
      { name: 'Cadeira adutora', sets: 3, reps: 15, rest: 60, timed: false },
      { name: 'Agachamento búlgaro', sets: 3, reps: 10, rest: 90, timed: false },
    ],
  },
  {
    key: 'ombros',
    label: 'Ombros',
    exercises: [
      { name: 'Desenvolvimento com barra', sets: 4, reps: 10, rest: 90, timed: false },
      { name: 'Elevação lateral com halteres', sets: 3, reps: 15, rest: 60, timed: false },
      { name: 'Elevação frontal com halteres', sets: 3, reps: 15, rest: 60, timed: false },
      { name: 'Remada alta com barra', sets: 3, reps: 12, rest: 60, timed: false },
      { name: 'Face pull no cabo', sets: 3, reps: 15, rest: 60, timed: false },
      { name: 'Arnold press', sets: 3, reps: 12, rest: 90, timed: false },
      { name: 'Desenvolvimento com halteres', sets: 4, reps: 10, rest: 90, timed: false },
      { name: 'Elevação lateral no cabo', sets: 3, reps: 15, rest: 60, timed: false },
    ],
  },
  {
    key: 'biceps',
    label: 'Bíceps',
    exercises: [
      { name: 'Rosca direta com barra', sets: 3, reps: 12, rest: 60, timed: false },
      { name: 'Rosca alternada com halteres', sets: 3, reps: 12, rest: 60, timed: false },
      { name: 'Rosca martelo', sets: 3, reps: 12, rest: 60, timed: false },
      { name: 'Rosca concentrada', sets: 3, reps: 15, rest: 45, timed: false },
      { name: 'Rosca no cabo', sets: 3, reps: 15, rest: 45, timed: false },
      { name: 'Rosca Scott com barra', sets: 3, reps: 12, rest: 60, timed: false },
      { name: 'Rosca inclinada com halteres', sets: 3, reps: 12, rest: 60, timed: false },
    ],
  },
  {
    key: 'triceps',
    label: 'Tríceps',
    exercises: [
      { name: 'Tríceps testa com barra', sets: 3, reps: 12, rest: 60, timed: false },
      { name: 'Tríceps corda no cabo', sets: 3, reps: 15, rest: 60, timed: false },
      { name: 'Tríceps coice com halter', sets: 3, reps: 15, rest: 45, timed: false },
      { name: 'Mergulho no banco', sets: 3, reps: 12, rest: 60, timed: false },
      { name: 'Extensão unilateral no cabo', sets: 3, reps: 12, rest: 60, timed: false },
      { name: 'Tríceps francês com halter', sets: 3, reps: 12, rest: 60, timed: false },
      { name: 'Supino fechado', sets: 3, reps: 12, rest: 90, timed: false },
    ],
  },
  {
    key: 'core',
    label: 'Core',
    exercises: [
      { name: 'Prancha frontal', sets: 3, reps: 30, rest: 30, timed: true },
      { name: 'Abdominal crunch', sets: 3, reps: 20, rest: 30, timed: false },
      { name: 'Abdominal bicicleta', sets: 3, reps: 20, rest: 30, timed: false },
      { name: 'Elevação de pernas', sets: 3, reps: 15, rest: 45, timed: false },
      { name: 'Russian twist', sets: 3, reps: 20, rest: 30, timed: false },
      { name: 'Abdominal no cabo', sets: 3, reps: 15, rest: 45, timed: false },
      { name: 'Dead bug', sets: 3, reps: 10, rest: 30, timed: false },
      { name: 'Prancha lateral', sets: 3, reps: 20, rest: 30, timed: true },
    ],
  },
  {
    key: 'mobilidade',
    label: 'Mobilidade',
    exercises: [
      { name: 'Mobilidade de quadril', sets: 2, reps: 30, rest: 15, timed: true },
      { name: 'Mobilidade torácica', sets: 2, reps: 30, rest: 15, timed: true },
      { name: 'Abertura de quadril 90/90', sets: 2, reps: 30, rest: 15, timed: true },
      { name: 'Rotação de ombro com bastão', sets: 2, reps: 15, rest: 15, timed: false },
      { name: 'Mobilidade de tornozelo', sets: 2, reps: 15, rest: 15, timed: false },
      { name: 'Cat-cow', sets: 2, reps: 10, rest: 15, timed: false },
      { name: 'World greatest stretch', sets: 2, reps: 8, rest: 15, timed: false },
      { name: 'Agachamento com pausa no fundo', sets: 2, reps: 30, rest: 15, timed: true },
    ],
  },
  {
    key: 'alongamento',
    label: 'Alongamento',
    exercises: [
      { name: 'Alongamento de isquiotibiais', sets: 2, reps: 30, rest: 15, timed: true },
      { name: 'Alongamento de quadríceps', sets: 2, reps: 30, rest: 15, timed: true },
      { name: 'Alongamento de panturrilha', sets: 2, reps: 30, rest: 15, timed: true },
      { name: 'Alongamento de peito', sets: 2, reps: 30, rest: 15, timed: true },
      { name: 'Alongamento de ombro cruzado', sets: 2, reps: 30, rest: 15, timed: true },
      { name: 'Alongamento de trapézio', sets: 2, reps: 30, rest: 15, timed: true },
      { name: 'Pigeon pose', sets: 2, reps: 45, rest: 15, timed: true },
      { name: 'Alongamento de lombar', sets: 2, reps: 30, rest: 15, timed: true },
    ],
  },
]
