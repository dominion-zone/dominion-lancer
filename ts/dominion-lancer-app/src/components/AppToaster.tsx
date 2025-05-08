import { Toast, Toaster, ToastProps, Transition, useToaster } from "terracotta";
import { createEffect, createSignal, For, JSX, onCleanup } from "solid-js";
import { X } from "lucide-solid";
import { Dynamic } from "solid-js/web";
import { notifications } from "~/stores/notification";

const AppToaster = () => {
  const toaster = useToaster(notifications);
  const [isOpen, setIsOpen] = createSignal(false);

  function closeNotifs(): void {
    setIsOpen(false);
  }

  function clearNotifs(): void {
    notifications.clear();
  }

  createEffect(() => {
    if (toaster().length > 0) {
      setIsOpen(true);
    }

    const timeout = setTimeout(() => {
      closeNotifs();
    }, 100000);

    onCleanup(() => {
      clearTimeout(timeout);
    });
  });

  return (
    <Toaster class="toaster">
      <Transition
        show={isOpen()}
        class="toaster__transition"
        enter="toaster__transition--enter"
        enterFrom="toaster__transition--enter-from"
        enterTo="toaster__transition--enter-to"
        leave="toaster__transition--leave"
        leaveFrom="toaster__transition--leave-from"
        leaveTo="toaster__transition--leave-to"
        afterLeave={clearNotifs}
      >
        <div class="toaster__container">
          <div class="toaster__header">
            <span class="toaster__title">Notifications</span>
            <button
              type="button"
              onClick={closeNotifs}
              class="toaster__close-btn"
            >
              <X class="toaster__close-icon" />
            </button>
          </div>
          <div class="toaster__notifications">
            <For
              each={toaster().slice(0).reverse()}
              fallback={
                <div class="toaster__empty">There are no notifications.</div>
              }
            >
              {({ id, data }): JSX.Element => (
                <Dynamic
                  component={(props: ToastProps) =>
                    data.render({ class: "toast", ...props })
                  }
                  id={id}
                />
              )}
            </For>
          </div>
        </div>
      </Transition>
    </Toaster>
  );
};

export default AppToaster;
