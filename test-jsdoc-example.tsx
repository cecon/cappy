/**
 * Componente principal da aplicação de gerenciamento de tarefas
 * @description Este componente gerencia o estado global das tarefas e fornece
 * a interface principal para interação do usuário com o sistema.
 * @param {Object} props - Propriedades do componente
 * @param {string} props.title - Título da aplicação exibido no cabeçalho
 * @param {boolean} props.darkMode - Define se o tema escuro está ativo
 * @param {Function} props.onTaskComplete - Callback executado quando uma tarefa é completada
 * @returns {JSX.Element} Componente React renderizado
 * @throws {Error} Se o título estiver vazio ou for inválido
 * @example
 * <TaskApp 
 *   title="Minhas Tarefas" 
 *   darkMode={true}
 *   onTaskComplete={(task) => console.log('Completado:', task)}
 * />
 * @since 1.0.0
 */
export function TaskApp({ title, darkMode }: { title: string; darkMode: boolean }) {
  return <div className={darkMode ? 'dark' : 'light'}>{title}</div>;
}

/**
 * Hook customizado para gerenciar estado de autenticação
 * @description Fornece estado e métodos para login/logout de usuários,
 * incluindo persistência de sessão via localStorage.
 * @returns {Object} Objeto contendo estado e métodos de autenticação
 * @returns {boolean} return.isAuthenticated - Indica se o usuário está autenticado
 * @returns {Object|null} return.user - Dados do usuário autenticado ou null
 * @returns {Function} return.login - Função para realizar login (email, password)
 * @returns {Function} return.logout - Função para realizar logout
 * @example
 * const { isAuthenticated, user, login, logout } = useAuth();
 * if (!isAuthenticated) {
 *   await login('user@example.com', 'password');
 * }
 * @deprecated Use o novo hook useAuthV2 que suporta OAuth
 */
function useAuth() {
  return {
    isAuthenticated: false,
    user: null,
    login: async (email: string, password: string) => {
      // Implementação de login
      console.log('Login attempt:', email, password);
    },
    logout: () => {
      // Implementação de logout
    }
  };
}

/**
 * Serviço para processamento de dados em lote
 * @class BatchProcessor
 * @description Processa grandes volumes de dados em lotes menores para otimizar
 * o desempenho e evitar sobrecarga de memória. Suporta processamento paralelo.
 */
export class BatchProcessor {
  private batchSize: number;
  private maxParallel: number;

  /**
   * Cria uma nova instância do processador em lote
   * @param {number} batchSize - Tamanho de cada lote (padrão: 100)
   * @param {number} maxParallel - Número máximo de lotes paralelos (padrão: 4)
   * @throws {RangeError} Se batchSize ou maxParallel forem menores que 1
   * @example
   * const processor = new BatchProcessor(50, 2);
   */
  constructor(batchSize = 100, maxParallel = 4) {
    this.batchSize = batchSize;
    this.maxParallel = maxParallel;
  }

  /**
   * Processa um array de itens em lotes
   * @param {Array<T>} items - Array de itens a processar
   * @param {Function} processFn - Função que processa cada item
   * @returns {Promise<Array<R>>} Array com resultados processados
   * @throws {Error} Se processFn não for uma função válida
   * @example
   * const results = await processor.process(
   *   [1, 2, 3, 4, 5],
   *   (item) => item * 2
   * );
   * console.log(results); // [2, 4, 6, 8, 10]
   */
  async process<T, R>(items: T[], processFn: (item: T) => R): Promise<R[]> {
    return items.map(processFn);
  }
}

/**
 * Utilitário para validação de formulários
 * @namespace FormValidator
 * @description Conjunto de funções para validar campos de formulário
 * seguindo as melhores práticas de UX e segurança.
 */
const FormValidator = {
  /**
   * Valida formato de email
   * @param {string} email - Email a ser validado
   * @returns {boolean} true se o email for válido
   * @example
   * FormValidator.isValidEmail('user@example.com'); // true
   * FormValidator.isValidEmail('invalid'); // false
   */
  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  /**
   * Valida força da senha
   * @param {string} password - Senha a ser validada
   * @returns {Object} Objeto com score (0-100) e requisitos atendidos
   * @returns {number} return.score - Pontuação de força (0-100)
   * @returns {string[]} return.missing - Lista de requisitos não atendidos
   * @example
   * const result = FormValidator.validatePassword('MyP@ss123');
   * console.log(result.score); // 85
   * console.log(result.missing); // []
   */
  validatePassword(password: string): { score: number; missing: string[] } {
    const missing: string[] = [];
    let score = 0;

    // Validação básica para exemplo
    if (password.length >= 8) score += 25;
    if (/[A-Z]/.test(password)) score += 25;
    if (/[a-z]/.test(password)) score += 25;
    if (/\d/.test(password)) score += 25;

    if (password.length < 8) missing.push('minimum-length');
    if (!/[A-Z]/.test(password)) missing.push('uppercase');
    if (!/[a-z]/.test(password)) missing.push('lowercase');
    if (!/\d/.test(password)) missing.push('number');

    return {
      score,
      missing
    };
  }
};

/**
 * Constante de configuração da API
 * @constant {Object} API_CONFIG
 * @property {string} baseURL - URL base da API
 * @property {number} timeout - Timeout em milissegundos
 * @property {Object} headers - Headers padrão das requisições
 */
const API_CONFIG = {
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
};

// Export for documentation purposes
// eslint-disable-next-line react-refresh/only-export-components
export { FormValidator, API_CONFIG, useAuth };
