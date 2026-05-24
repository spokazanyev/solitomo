import "server-only";

import { registerSubscriber, unregisterSubscriber, type DomainEventSubscriber } from "../lifecycle/events";
import { emitNotificationJobs } from "./emitter";
import { logError } from "./logger";

/**
 * Подписчик 049 на доменные события: ставит уведомления в очередь по матрице
 * notification-jobs. Сама отправка — в cron-runner `processNotificationQueue`.
 *
 * При первом успешном вызове снимаем 047-stub (`047-email-stub`), чтобы не дублировать
 * транзакционные письма.
 */
const subscriber: DomainEventSubscriber = {
  name: "049-notifications",
  async handle(event) {
    try {
      await emitNotificationJobs(event);
    } catch (err) {
      logError("subscriber", "emitNotificationJobs failed", err);
    }
  },
};

let registered = false;

export function registerNotificationsSubscriber(): void {
  if (registered) return;
  // Если 049 активен — снимаем 047 stub (он покрывал только 4 события напрямую).
  // Делать это здесь безопасно: registerCoreSubscribers вызывает 047-stub раньше 049.
  unregisterSubscriber("047-email-stub");
  registerSubscriber(subscriber);
  registered = true;
}
