import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Nouvelle règle (eslint-plugin-react-hooks v6, livrée avec Next 16) qui flag en erreur
      // un pattern pré-existant très répandu (reset d'état dans un effet). À nettoyer dans une
      // passe dédiée plutôt que de bloquer le lint pour tout le monde ce soir.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default eslintConfig;
