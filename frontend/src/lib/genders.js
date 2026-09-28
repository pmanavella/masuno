// Valores tal como están en la base (minúsculas, sin tildes) y su etiqueta para la UI.
export const GENDER_LABELS = {
  indistinto: 'Indistinto',
  masculino: 'Masculino',
  femenino: 'Femenino',
  no_binario: 'No binario',
};

// Géneros de una persona (sin 'indistinto', que solo aplica a eventos).
export const PERSON_GENDERS = ['masculino', 'femenino', 'no_binario'];

export function genderLabel(value) {
  return GENDER_LABELS[value] ?? value;
}
