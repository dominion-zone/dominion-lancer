import {SuiTransactionBlockResponse} from '@mysten/sui/client';
import {Submission} from '@solidjs/router';
import {useNotifications} from '../contexts/Notifications';
import {
  ErrorNotification,
  TransactionSuccessNotification,
} from '../stores/notifications';

const onTxComplete =
  <T extends {network: string; user: string}>(
    wrapper: ({
      network,
      user,
      response,
    }: T & {
      response: SuiTransactionBlockResponse;
    }) => TransactionSuccessNotification = ({network, user, response}) =>
      new TransactionSuccessNotification(response, network, user),
  ) =>
  (
    submission: Submission<
      [T],
      SuiTransactionBlockResponse
    >,
  ) => {
    const notifs = useNotifications();
    if (submission.error) {
      notifs.create(new ErrorNotification(submission.error));
    } else {
      notifs.create(
        wrapper({
          ...submission.input[0],
          response: submission.result,
        }),
      );
    }
  };

export default onTxComplete;
