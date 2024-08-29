import { Registry } from 'vs/platform/registry/common/platform';
import {
	Extensions as ViewContainerExtensions, IViewContainersRegistry,
	ViewContainerLocation, IViewsRegistry, Extensions as ViewExtensions,
	IViewDescriptor
} from 'vs/workbench/common/views';

import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';


import * as nls from 'vs/nls';

import { Codicon } from 'vs/base/common/codicons';
import { localize } from 'vs/nls';
import { registerIcon } from 'vs/platform/theme/common/iconRegistry';
import { ViewPaneContainer } from 'vs/workbench/browser/parts/views/viewPaneContainer';

import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';


const glassViewIcon = registerIcon('glass-view-icon', Codicon.search, localize('glassViewIcon', 'View icon of the glass chat view.'));


// compare against search.contribution.ts and https://app.greptile.com/chat/w1nsmt3lauwzculipycpn?repo=github%3Amain%3Amicrosoft%2Fvscode


const VIEWLET_ID = 'workbench.view.glass.chat'
const VIEW_ID = VIEWLET_ID
// Register view container
const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const viewContainer = viewContainerRegistry.registerViewContainer({
	id: VIEWLET_ID,
	title: nls.localize2('chat', 'Glass Chat'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [VIEWLET_ID, { mergeViewWithContainerWhenSingleView: true }]),
	hideIfEmpty: true,
	icon: glassViewIcon,
	order: 1,
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: true });




// descriptor
const viewDescriptor: IViewDescriptor = {
	id: VIEW_ID,
	containerIcon: glassViewIcon,
	name: nls.localize2('search', "Search"),
	ctorDescriptor: new SyncDescriptor(GlassView),
	canToggleVisibility: false,
	canMoveView: true,
	openCommandActionDescriptor: {
		id: viewContainer.id,
		mnemonicTitle: nls.localize({ key: 'miViewSearch', comment: ['&& denotes a mnemonic'] }, "&&Search"),
		keybindings: {
			primary: KeyMod.CtrlCmd | KeyMod.M, // TODO do we need to disable ctrl M?
		},
		order: 1
	}
};






// Register view itself
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: MyNewView.ID,
	name: MyNewView.TITLE,
	ctorDescriptor: new SyncDescriptor(MyNewView),
	canToggleVisibility: true,
	canMoveView: true,
	when: ContextKeyExpr.equals('myContextKey', true),
}], viewContainer);



// Register search default location to sidebar
Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([viewDescriptor], viewContainer);
