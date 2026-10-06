// Interfaz común de los clientes del Padrón A13 de ARCA. Cada implementación resuelve las
// dos operaciones del web service; findPersonsByDni las combina igual para ambas.
//
// Persona normalizada:
//   { cuil, firstName, lastName, birthDate ('YYYY-MM-DD' | null), personType ('FISICA' | 'JURIDICA'),
//     keyStatus ('ACTIVO' | ...), deceased (boolean) }

export class ArcaUnavailableError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'ArcaUnavailableError';
  }
}

export class ArcaClient {
  // Origen de la verificación en private.identities. La base solo acepta 'arca' para filas nuevas.
  source = 'arca';

  // Devuelve los CUIL/CUIT asociados a un número de documento ([] si no hay ninguno).
  async getIdPersonaListByDocumento(_dni) {
    throw new Error('No implementado');
  }

  // Devuelve la persona normalizada, o null si ARCA no la encuentra.
  async getPersona(_cuil) {
    throw new Error('No implementado');
  }

  async findPersonsByDni(dni) {
    const ids = await this.getIdPersonaListByDocumento(dni);
    const persons = await Promise.all(ids.map((id) => this.getPersona(id)));
    return persons.filter(Boolean);
  }
}
