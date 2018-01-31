import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { Collections, Nullable, Numbers, Try } from 'javascriptutilities';
import { ReduxStore as Store } from 'reactive-rx-redux-js';
import { Data } from 'react-base-utilities-js';
import { ErrorDisplay } from 'react-error-display-components';
import { PhoneInput } from './../src';

type CC = Data.CountryCode.Type;

let countryCodes: CC[] = Numbers.range(1, 100)
  .map(v => '' + v)
  .map(v => ({ code: v, callingCode: v, name: 'place' + v }));

namespace CountryCode {
  export class Self implements PhoneInput.Base.Provider.CountryCodeType {
    public fetchCodes<Prev>(prev: Try<Prev>): Observable<Try<CC[]>> {
      return Observable.of(prev.map(() => countryCodes));
    }
  }
}

describe('Phone input view model should work correctly', () => {
  let delay = 0.2;
  let subscription: Subscription;
  let rxProvider: PhoneInput.Rx.Provider.Type;
  let rxModel: PhoneInput.Rx.Model.Self;

  beforeEach(() => {
    subscription = new Subscription();
    let rxAction = PhoneInput.Rx.Action.createDefault();
    let rxErrorAction = ErrorDisplay.Rx.Action.createDefault();
    let rxErrorActionProvider = { error: rxErrorAction };

    let rxActionProvider = {
      ...rxErrorActionProvider,
      phoneInput: rxAction,
    };

    let rxErrorReducers = ErrorDisplay.Rx.Reducer.createDefault(rxErrorActionProvider);
    let rxReducers = PhoneInput.Rx.Reducer.createDefault('', rxActionProvider);
    let rxStore = new Store.Rx.Self(rxErrorReducers, ...rxReducers);

    rxProvider = {
      action: rxActionProvider,
      countryCodes: new CountryCode.Self(),
      constants: { error: { displayDuration: 0 } },
      store: rxStore,
      substateSeparator: '.',
    };

    rxModel = new PhoneInput.Rx.Model.Self(rxProvider, '');
  });

  let testExtensionSearchQuery = (
    provider: PhoneInput.Base.Provider.Type,
    model: PhoneInput.Base.Model.Type,
  ): void => {
    /// Setup
    let selectableSbj = new BehaviorSubject<CC[]>([]);
    let extSearchInputSbj = new BehaviorSubject<Nullable<string>>(undefined);
    let extSbj = new BehaviorSubject<Nullable<CC>>(undefined);
    let viewModel = new PhoneInput.Base.ViewModel.Self(provider, model);
    let stateStream = viewModel.stateStream().mapNonNilOrEmpty(v => v).shareReplay(1);

    viewModel.initialize();

    stateStream
      .map(v => viewModel.selectableCodesForState(v))
      .mapNonNilOrElse(v => v, () => [])
      .subscribe(selectableSbj)
      .toBeDisposedBy(subscription);

    stateStream
      .map(v => model.extensionForState(v))
      .mapNonNilOrEmpty(v => v)
      .subscribe(extSbj)
      .toBeDisposedBy(subscription);

    stateStream
      .map(v => model.extSearchForState(v))
      .mapNonNilOrElse(v => v, '')
      .subscribe(extSearchInputSbj)
      .toBeDisposedBy(subscription);

    for (let code of countryCodes) {
      /// When
      viewModel.triggerExtSearchInput(code.name);

      // This part needs a timeout because there's a slight delay between the
      // extension search input trigger and the selectable code trigger.
      setTimeout(() => {
        let filtered = model.filterCodes(countryCodes, code.name);
        let selectable = selectableSbj.value;
        expect(filtered).toEqual(selectable);

        /// Select a country code item to see if the extension code is updated.
        let selected = Collections.randomElement(filtered).getOrThrow();
        viewModel.triggerSelectedCountryCode(selected);
        expect(extSbj.value).toBe(selected);
        expect(extSearchInputSbj.value).toBe('');
      }, delay);
    }
  };

  it('Trigger rx extension search query - should update selectable codes', () => {
    testExtensionSearchQuery(rxProvider, rxModel);
  });
});