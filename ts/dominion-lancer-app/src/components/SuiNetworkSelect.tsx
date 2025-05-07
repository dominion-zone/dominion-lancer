import {Component, JSX, mergeProps, Setter, Show, splitProps} from 'solid-js';
import {CheckIcon, ChevronsUpDown} from 'lucide-solid';
import {For} from 'solid-js';
import {
  DisclosureStateChild,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  ListboxSingleProps,
  Transition,
} from 'terracotta';

export type SuiNetworkSelectStyle = {
  root?: string;
  container?: string;
  button?: string;
  buttonText?: string;
  buttonIcon?: string;
  ['transition--enter']?: string;
  ['transition--enter-from']?: string;
  ['transition--enter-to']?: string;
  ['transition--leave']?: string;
  ['transition--leave-from']?: string;
  ['transition--leave-to']?: string;
  options?: string;
  option?: string;
  ['option-active']?: string;
  ['option-content']?: string;
  ['option-text']?: string;
  ['option-text--selected']?: string;
  ['check-icon']?: string;
  icon?: string;
};

export type SuiNetworkSelectProps = Omit<
  ListboxSingleProps<string>,
  'value' | 'onSelectChange'
> & {
  style?: SuiNetworkSelectStyle;
  networks: string[];
  network: string;
  setNetwork: Setter<string>;
};

export const SuiNetworkSelect: Component<SuiNetworkSelectProps> = props => {
  const defaultedProps = mergeProps(
    {
      get class() {
        return props.style?.root ?? 'listbox';
      },
      defaultOpen: false,
    },
    props,
  );
  const [myProps, listboxProps] = splitProps(defaultedProps, [
    'networks',
    'network',
    'setNetwork',
  ]);
  return (
    <Listbox
      value={props.network}
      onSelectChange={props.setNetwork}
      {...listboxProps}
    >
      <div class={props.style?.container ?? 'listbox__container'}>
        <ListboxButton
          class={props.style?.button ?? 'listbox__button'}
          type="button"
        >
          <span class={props.style?.buttonText ?? 'listbox__button-text'}>
            {myProps.network}
          </span>
          <span class={props.style?.buttonIcon ?? 'listbox__button-icon'}>
            <ChevronsUpDown
              class={props.style?.icon ?? 'listbox__icon'}
              aria-hidden="true"
            />
          </span>
        </ListboxButton>
        <DisclosureStateChild>
          {({isOpen}): JSX.Element => (
            <Transition
              show={isOpen()}
              enter={
                props.style?.['transition--enter'] ??
                'listbox__transition--enter'
              }
              enterFrom={
                props.style?.['transition--enter-from'] ??
                'listbox__transition--enter-from'
              }
              enterTo={
                props.style?.['transition--enter-to'] ??
                'listbox__transition--enter-to'
              }
              leave={
                props.style?.['transition--leave'] ??
                'listbox__transition--leave'
              }
              leaveFrom={
                props.style?.['transition--leave-from'] ??
                'listbox__transition--leave-from'
              }
              leaveTo={
                props.style?.['transition--leave-to'] ??
                'listbox__transition--leave-to'
              }
            >
              <ListboxOptions
                unmount={false}
                class={props.style?.options ?? 'listbox__options'}
              >
                <For each={myProps.networks}>
                  {(network): JSX.Element => (
                    <ListboxOption
                      class={props.style?.option ?? 'listbox__option'}
                      value={network}
                    >
                      {({isActive, isSelected}): JSX.Element => (
                        <div
                          classList={{
                            [props.style?.['option-content'] ??
                            'listbox__option-content']: true,
                            [props.style?.['option-active'] ??
                            'listbox__option--active']: isActive(),
                          }}
                        >
                          <span
                            classList={{
                              [props.style?.['option-text'] ??
                              'listbox__option-text']: true,
                              [props.style?.['option-text--selected'] ??
                              'listbox__option-text--selected']: isSelected(),
                            }}
                          >
                            {network}
                          </span>
                          <Show when={isSelected()}>
                            <span
                              class={
                                props.style?.['check-icon'] ??
                                'listbox__check-icon'
                              }
                            >
                              <CheckIcon
                                class={props.style?.icon ?? 'listbox__icon'}
                                aria-hidden="true"
                              />
                            </span>
                          </Show>
                        </div>
                      )}
                    </ListboxOption>
                  )}
                </For>
              </ListboxOptions>
            </Transition>
          )}
        </DisclosureStateChild>
      </div>
    </Listbox>
  );
};
