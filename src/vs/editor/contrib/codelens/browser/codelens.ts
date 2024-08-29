/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { onUnexpectedExternalError } from 'vs/base/common/errors';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { ITextModel } from 'vs/editor/common/model';
import { CodeLens, CodeLensList, CodeLensProvider } from 'vs/editor/common/languages';
import { LanguageFeatureRegistry } from 'vs/editor/common/languageFeatureRegistry';

export interface CodeLensItem {
	symbol: CodeLens;
	provider: CodeLensProvider;
}

export class CodeLensModel {

	lenses: CodeLensItem[] = [];

	private readonly _disposables = new DisposableStore();

	dispose(): void {
		this._disposables.dispose();
	}

	get isDisposed(): boolean {
		return this._disposables.isDisposed;
	}

	add(list: CodeLensList, provider: CodeLensProvider): void {
		this._disposables.add(list);
		for (const symbol of list.lenses) {
			this.lenses.push({ symbol, provider });
		}
	}
}

export async function getCodeLensModel(registry: LanguageFeatureRegistry<CodeLensProvider>, model: ITextModel, token: CancellationToken): Promise<CodeLensModel> {

	const provider = registry.ordered(model);
	const providerRanks = new Map<CodeLensProvider, number>();
	const result = new CodeLensModel();

	const promises = provider.map(async (provider, i) => {

		providerRanks.set(provider, i);

		try {
			const list = await Promise.resolve(provider.provideCodeLenses(model, token));
			if (list) {
				result.add(list, provider);
			}
		} catch (err) {
			onUnexpectedExternalError(err);
		}
	});

	await Promise.all(promises);

	result.lenses = result.lenses.sort((a, b) => {
		// sort by lineNumber, provider-rank, and column
		if (a.symbol.range.startLineNumber < b.symbol.range.startLineNumber) {
			return -1;
		} else if (a.symbol.range.startLineNumber > b.symbol.range.startLineNumber) {
			return 1;
		} else if ((providerRanks.get(a.provider)!) < (providerRanks.get(b.provider)!)) {
			return -1;
		} else if ((providerRanks.get(a.provider)!) > (providerRanks.get(b.provider)!)) {
			return 1;
		} else if (a.symbol.range.startColumn < b.symbol.range.startColumn) {
			return -1;
		} else if (a.symbol.range.startColumn > b.symbol.range.startColumn) {
			return 1;
		} else {
			return 0;
		}
	});
	return result;
}
