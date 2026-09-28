import { ArcaClient, ArcaUnavailableError } from './ArcaClient.js';

// Fixtures locales (datos inventados, CUIL con dígito verificador válido):
//   30123456  adulta válida: Lucía Belén Martínez, 10/03/1995
//   45111222  17 años (se calcula desde hoy, así nunca cumple 18): Tomás Giménez
//   28999888  dos CUIL para el mismo DNI: Juan Carlos Pérez (1980) y María Inés Gómez (1976)
//   99999999  simula ARCA caído
// Cualquier otro DNI: ARCA no encuentra personas.
function seventeenYearsAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 17);
  return d.toISOString().slice(0, 10);
}

const DNI_TO_CUILS = {
  30123456: ['27301234568'],
  45111222: ['20451112229'],
  28999888: ['20289998889', '27289998883'],
};

const PERSONS = {
  27301234568: () => ({ firstName: 'LUCIA BELEN', lastName: 'MARTINEZ', birthDate: '1995-03-10' }),
  20451112229: () => ({ firstName: 'TOMAS', lastName: 'GIMENEZ', birthDate: seventeenYearsAgo() }),
  20289998889: () => ({ firstName: 'JUAN CARLOS', lastName: 'PEREZ', birthDate: '1980-07-21' }),
  27289998883: () => ({ firstName: 'MARIA INES', lastName: 'GOMEZ', birthDate: '1976-11-02' }),
};

const UNAVAILABLE_DNI = '99999999';

export class MockArcaClient extends ArcaClient {
  source = 'mock';

  constructor({ nodeEnv = process.env.NODE_ENV } = {}) {
    super();
    if (nodeEnv === 'production') {
      throw new Error('ARCA_MODE=mock no está permitido con NODE_ENV=production');
    }
  }

  async getIdPersonaListByDocumento(dni) {
    if (dni === UNAVAILABLE_DNI) {
      throw new ArcaUnavailableError('ARCA simulado fuera de servicio');
    }
    return DNI_TO_CUILS[dni] ?? [];
  }

  async getPersona(cuil) {
    const person = PERSONS[cuil]?.();
    if (!person) return null;
    return { cuil, ...person, personType: 'FISICA', keyStatus: 'ACTIVO', deceased: false };
  }
}
