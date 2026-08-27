import { Locale, TicketPriority, TicketStatus } from '@veloxdesk/types';

// Every user-facing string the client-facing Telegram bot sends, across the
// three services that talk to a client through it (telegram-ingestion's
// conversational bot, chat.service.ts's live-forward of an operator reply,
// telegram-csat-notify's post-close survey push). Keyed by Locale so the bot
// replies in whichever language is set on the sender's UserEntity.locale —
// that row is always re-fetched fresh per Telegram update (no caching
// anywhere in the resolution path), so a locale changed on the web portal
// takes effect starting the client's very next bot interaction, with no
// separate push/event needed.
//
// Record<Locale, BotStrings> against this shared interface is what makes a
// locale falling behind (missing/mistyped key) a compile error instead of a
// silent runtime gap — deliberately no separate `t(locale, key)` indirection
// on top of that; every call site already referenced a bare identifier
// before this file existed, so `s.key` is a 1:1 rename of that identifier.
//
// statusLabels/priorityLabels reuse the exact wording already shipped in
// frontend/*/src/locales/*.json's ticketStatus/ticketPriority — same status
// names a client already sees on the web, not a second independent
// translation of the same four/four words.
export interface BotStrings {
  greetingLinked: string;
  greetingUnlinked: string;
  linkSuccess: string;
  linkFailed: string;

  btnCreateTicket: string;
  btnMyTickets: string;
  btnKnowledgeBase: string;
  btnWatching: string;
  btnHistory: string;
  btnBack: string;
  btnShowMore: string;
  btnToList: string;
  btnWatchOn: string;
  btnWatchOff: string;

  createTicketPrompt: string;
  backText: string;
  newTicketConfirmation: (n: number) => string;
  appendConfirmation: (n: number) => string;
  attachmentFailed: string;
  photoFallbackTitle: string;
  documentFallbackTitle: string;

  statusLabels: Record<TicketStatus, string>;
  priorityLabels: Record<TicketPriority, string>;
  statusHeaderLabel: string;
  priorityHeaderLabel: string;
  createdHeaderLabel: string;

  ticketNotFoundToast: string;
  replyTargetClosed: string;
  watchOnToast: string;
  watchOffToast: string;
  noMoreCommentsToast: string;
  noMessagesYetText: string;
  youLabel: string;
  operatorLabel: string;
  chooseTicketText: string;

  // `listHeader`'s "(показаны 5 из 20):" suffix — text embedded inside a
  // helper function rather than a swappable constant, so it needs its own
  // dictionary entry same as everything else.
  listHeaderPartial: (shown: number, total: number) => string;

  myTicketsHeader: string;
  myTicketsEmpty: string;
  watchingHeader: string;
  watchingEmpty: string;
  historyHeader: string;
  historyEmpty: string;
  kbArticlesHeader: string;
  kbEmpty: string;
  kbChoose: string;
  articleNotFound: string;

  adminNotAuthorizedToast: string;
  adminAlreadyHandledToast: string;
  adminApprovedToast: string;
  adminRejectedToast: string;

  csatThankYou: string;
  csatSubmitFailedToast: string;
  csatProgressToast: (answered: number, total: number) => string;
  csatClosedNoQuestions: (ticketNumber: number) => string;
  csatClosedWithQuestions: (ticketNumber: number) => string;

  openTicketButton: string;
}

export const BOT_STRINGS: Record<Locale, BotStrings> = {
  [Locale.RU]: {
    greetingLinked:
      'Здравствуйте! Опишите ваш вопрос одним сообщением — мы создадим тикет и ответим здесь же, в Telegram.',
    greetingUnlinked:
      'Этот бот доступен только зарегистрированным клиентам. Чтобы подключить Telegram к вашему аккаунту, откройте личный кабинет на сайте → Настройки → Telegram, и перейдите по ссылке.',
    linkSuccess: 'Telegram успешно подключён к вашему аккаунту. Опишите ваш вопрос одним сообщением.',
    linkFailed: 'Ссылка недействительна или устарела. Сгенерируйте новую в личном кабинете → Настройки → Telegram.',

    btnCreateTicket: '📝 Создать тикет',
    btnMyTickets: '📋 Мои тикеты',
    btnKnowledgeBase: '📚 База знаний',
    btnWatching: '👁 Под контролем',
    btnHistory: '🗂 История',
    btnBack: '⬅️ Назад',
    btnShowMore: '⬇️ Показать ещё',
    btnToList: '⬅️ К списку',
    btnWatchOn: '👁 Следить',
    btnWatchOff: '🚫 Не следить',

    createTicketPrompt: 'Опишите ваш вопрос одним сообщением — мы создадим новый тикет.',
    backText: 'Главное меню.',
    newTicketConfirmation: (n) => `Тикет №${n} создан, мы ответим здесь.`,
    appendConfirmation: (n) => `Сообщение добавлено к тикету №${n}.`,
    attachmentFailed: 'Не удалось получить файл из Telegram — попробуйте отправить его ещё раз, или опишите вопрос текстом.',
    photoFallbackTitle: 'Фото',
    documentFallbackTitle: 'Файл',

    statusLabels: {
      [TicketStatus.OPEN]: 'В работе',
      [TicketStatus.PENDING]: 'Ожидание',
      [TicketStatus.RESOLVED]: 'Передано разработчикам',
      [TicketStatus.CLOSED]: 'Завершено',
    },
    priorityLabels: {
      [TicketPriority.LOW]: 'Низкий',
      [TicketPriority.MEDIUM]: 'Средний',
      [TicketPriority.HIGH]: 'Высокий',
      [TicketPriority.URGENT]: 'Срочный',
    },
    statusHeaderLabel: 'Статус:',
    priorityHeaderLabel: 'Приоритет:',
    createdHeaderLabel: 'Создано:',

    ticketNotFoundToast: 'Тикет не найден.',
    replyTargetClosed: 'Этот тикет уже завершён и недоступен для ответа. Опишите новый вопрос, если он всё ещё актуален.',
    watchOnToast: 'Вы теперь следите за тикетом.',
    watchOffToast: 'Вы больше не следите за тикетом.',
    noMoreCommentsToast: 'Это все сообщения по тикету.',
    noMessagesYetText: 'Сообщений пока нет.',
    youLabel: 'Вы',
    operatorLabel: 'Оператор',
    chooseTicketText: 'Выберите тикет:',

    listHeaderPartial: (shown, total) => `показаны ${shown} из ${total}`,

    myTicketsHeader: 'Ваши активные тикеты',
    myTicketsEmpty: 'У вас пока нет активных тикетов.',
    watchingHeader: 'Тикеты, за которыми вы следите',
    watchingEmpty: 'Вы пока не следите ни за одним тикетом.',
    historyHeader: 'Завершённые тикеты',
    historyEmpty: 'У вас пока нет завершённых тикетов.',
    kbArticlesHeader: 'Статьи базы знаний',
    kbEmpty: 'Пока нет опубликованных статей.',
    kbChoose: 'Выберите статью, чтобы прочитать:',
    articleNotFound: 'Статья не найдена — возможно, её уже сняли с публикации.',

    adminNotAuthorizedToast: 'Недостаточно прав.',
    adminAlreadyHandledToast: 'Уже обработано.',
    adminApprovedToast: 'Пользователь активирован.',
    adminRejectedToast: 'Регистрация отклонена.',

    csatThankYou: 'Спасибо за вашу оценку!',
    csatSubmitFailedToast: 'Не удалось сохранить оценку — попробуйте ещё раз.',
    csatProgressToast: (answered, total) => `Принято (${answered} из ${total})`,
    csatClosedNoQuestions: (ticketNumber) => `Тикет №${ticketNumber} закрыт. Спасибо за тикет!`,
    csatClosedWithQuestions: (ticketNumber) => `Тикет №${ticketNumber} закрыт. Пожалуйста, оцените нашу работу:`,

    openTicketButton: 'Открыть тикет',
  },

  [Locale.UK]: {
    greetingLinked:
      'Вітаємо! Опишіть ваше питання одним повідомленням — ми створимо тікет і відповімо тут же, у Telegram.',
    greetingUnlinked:
      'Цей бот доступний лише зареєстрованим клієнтам. Щоб підключити Telegram до вашого акаунта, відкрийте особистий кабінет на сайті → Налаштування → Telegram, і перейдіть за посиланням.',
    linkSuccess: 'Telegram успішно підключено до вашого акаунта. Опишіть ваше питання одним повідомленням.',
    linkFailed: 'Посилання недійсне або застаріле. Згенеруйте нове в особистому кабінеті → Налаштування → Telegram.',

    btnCreateTicket: '📝 Створити тікет',
    btnMyTickets: '📋 Мої тікети',
    btnKnowledgeBase: '📚 База знань',
    btnWatching: '👁 Під контролем',
    btnHistory: '🗂 Історія',
    btnBack: '⬅️ Назад',
    btnShowMore: '⬇️ Показати ще',
    btnToList: '⬅️ До списку',
    btnWatchOn: '👁 Стежити',
    btnWatchOff: '🚫 Не стежити',

    createTicketPrompt: 'Опишіть ваше питання одним повідомленням — ми створимо новий тікет.',
    backText: 'Головне меню.',
    newTicketConfirmation: (n) => `Тікет №${n} створено, ми відповімо тут.`,
    appendConfirmation: (n) => `Повідомлення додано до тікета №${n}.`,
    attachmentFailed: 'Не вдалося отримати файл з Telegram — спробуйте надіслати його ще раз, або опишіть питання текстом.',
    photoFallbackTitle: 'Фото',
    documentFallbackTitle: 'Файл',

    statusLabels: {
      [TicketStatus.OPEN]: 'В роботі',
      [TicketStatus.PENDING]: 'Очікування',
      [TicketStatus.RESOLVED]: 'Передано розробникам',
      [TicketStatus.CLOSED]: 'Завершено',
    },
    priorityLabels: {
      [TicketPriority.LOW]: 'Низький',
      [TicketPriority.MEDIUM]: 'Середній',
      [TicketPriority.HIGH]: 'Високий',
      [TicketPriority.URGENT]: 'Терміновий',
    },
    statusHeaderLabel: 'Статус:',
    priorityHeaderLabel: 'Пріоритет:',
    createdHeaderLabel: 'Створено:',

    ticketNotFoundToast: 'Тікет не знайдено.',
    replyTargetClosed: 'Цей тікет вже завершено і недоступний для відповіді. Опишіть нове питання, якщо воно ще актуальне.',
    watchOnToast: 'Ви тепер стежите за тікетом.',
    watchOffToast: 'Ви більше не стежите за тікетом.',
    noMoreCommentsToast: 'Це всі повідомлення по тікету.',
    noMessagesYetText: 'Повідомлень поки немає.',
    youLabel: 'Ви',
    operatorLabel: 'Оператор',
    chooseTicketText: 'Виберіть тікет:',

    listHeaderPartial: (shown, total) => `показано ${shown} з ${total}`,

    myTicketsHeader: 'Ваші активні тікети',
    myTicketsEmpty: 'У вас поки немає активних тікетів.',
    watchingHeader: 'Тікети, за якими ви стежите',
    watchingEmpty: 'Ви поки не стежите за жодним тікетом.',
    historyHeader: 'Завершені тікети',
    historyEmpty: 'У вас поки немає завершених тікетів.',
    kbArticlesHeader: 'Статті бази знань',
    kbEmpty: 'Поки немає опублікованих статей.',
    kbChoose: 'Виберіть статтю, щоб прочитати:',
    articleNotFound: 'Статтю не знайдено — можливо, її вже зняли з публікації.',

    adminNotAuthorizedToast: 'Недостатньо прав.',
    adminAlreadyHandledToast: 'Вже оброблено.',
    adminApprovedToast: 'Користувача активовано.',
    adminRejectedToast: 'Реєстрацію відхилено.',

    csatThankYou: 'Дякуємо за вашу оцінку!',
    csatSubmitFailedToast: 'Не вдалося зберегти оцінку — спробуйте ще раз.',
    csatProgressToast: (answered, total) => `Прийнято (${answered} з ${total})`,
    csatClosedNoQuestions: (ticketNumber) => `Тікет №${ticketNumber} закрито. Дякуємо за тікет!`,
    csatClosedWithQuestions: (ticketNumber) => `Тікет №${ticketNumber} закрито. Будь ласка, оцініть нашу роботу:`,

    openTicketButton: 'Відкрити тікет',
  },

  [Locale.EN]: {
    greetingLinked:
      "Hello! Describe your issue in one message — we'll create a ticket and reply right here in Telegram.",
    greetingUnlinked:
      'This bot is only available to registered clients. To link Telegram to your account, open the portal → Settings → Telegram, and follow the link.',
    linkSuccess: 'Telegram has been linked to your account. Describe your issue in one message.',
    linkFailed: 'This link is invalid or has expired. Generate a new one in the portal → Settings → Telegram.',

    btnCreateTicket: '📝 Create ticket',
    btnMyTickets: '📋 My tickets',
    btnKnowledgeBase: '📚 Knowledge base',
    btnWatching: '👁 Watching',
    btnHistory: '🗂 History',
    btnBack: '⬅️ Back',
    btnShowMore: '⬇️ Show more',
    btnToList: '⬅️ To list',
    btnWatchOn: '👁 Watch',
    btnWatchOff: '🚫 Unwatch',

    createTicketPrompt: "Describe your issue in one message — we'll create a new ticket.",
    backText: 'Main menu.',
    newTicketConfirmation: (n) => `Ticket #${n} created, we'll reply here.`,
    appendConfirmation: (n) => `Message added to ticket #${n}.`,
    attachmentFailed: 'Could not fetch the file from Telegram — try sending it again, or describe the issue as text.',
    photoFallbackTitle: 'Photo',
    documentFallbackTitle: 'File',

    statusLabels: {
      [TicketStatus.OPEN]: 'Open',
      [TicketStatus.PENDING]: 'Pending',
      [TicketStatus.RESOLVED]: 'Handed off to developers',
      [TicketStatus.CLOSED]: 'Closed',
    },
    priorityLabels: {
      [TicketPriority.LOW]: 'Low',
      [TicketPriority.MEDIUM]: 'Medium',
      [TicketPriority.HIGH]: 'High',
      [TicketPriority.URGENT]: 'Urgent',
    },
    statusHeaderLabel: 'Status:',
    priorityHeaderLabel: 'Priority:',
    createdHeaderLabel: 'Created:',

    ticketNotFoundToast: 'Ticket not found.',
    replyTargetClosed: 'This ticket is already closed and no longer accepts replies. Describe a new issue if it is still relevant.',
    watchOnToast: 'You are now watching this ticket.',
    watchOffToast: 'You are no longer watching this ticket.',
    noMoreCommentsToast: "That's all the messages on this ticket.",
    noMessagesYetText: 'No messages yet.',
    youLabel: 'You',
    operatorLabel: 'Operator',
    chooseTicketText: 'Choose a ticket:',

    listHeaderPartial: (shown, total) => `showing ${shown} of ${total}`,

    myTicketsHeader: 'Your active tickets',
    myTicketsEmpty: "You don't have any active tickets yet.",
    watchingHeader: "Tickets you're watching",
    watchingEmpty: "You aren't watching any tickets yet.",
    historyHeader: 'Closed tickets',
    historyEmpty: "You don't have any closed tickets yet.",
    kbArticlesHeader: 'Knowledge base articles',
    kbEmpty: 'No published articles yet.',
    kbChoose: 'Choose an article to read:',
    articleNotFound: 'Article not found — it may have been unpublished.',

    adminNotAuthorizedToast: 'Not authorized.',
    adminAlreadyHandledToast: 'Already handled.',
    adminApprovedToast: 'User activated.',
    adminRejectedToast: 'Registration rejected.',

    csatThankYou: 'Thank you for your rating!',
    csatSubmitFailedToast: 'Could not save your rating — please try again.',
    csatProgressToast: (answered, total) => `Recorded (${answered} of ${total})`,
    csatClosedNoQuestions: (ticketNumber) => `Ticket #${ticketNumber} closed. Thank you for reaching out!`,
    csatClosedWithQuestions: (ticketNumber) => `Ticket #${ticketNumber} closed. Please rate our work:`,

    openTicketButton: 'Open ticket',
  },
};
