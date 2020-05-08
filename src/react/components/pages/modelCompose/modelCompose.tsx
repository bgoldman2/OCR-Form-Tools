// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import React from "react";
import {connect} from "react-redux";
import url from "url";
import _ from "lodash";
import { RouteComponentProps } from "react-router-dom";
import { IProject, IConnection, IAppSettings, IApplicationState } from "../../../../models/applicationState";
import { constants } from "../../../../common/constants";
import ServiceHelper from "../../../../services/serviceHelper";
import { IColumn,
         Fabric,
         DetailsList,
         Selection, SelectionMode,
         DetailsListLayoutMode, Customizer,
         ICustomizations,
         Spinner,
         SpinnerSize,
         FontIcon,
         TextField} from "office-ui-fabric-react";
import "./modelCompose.scss";
import { strings } from "../../../../common/strings";
import { getDarkGreyTheme, getDefaultDarkTheme, getPrimaryWhiteTheme } from "../../../../common/themes";
import { ModelComposeCommandBar } from "./composeCommandBar";
import { bindActionCreators } from "redux";
import IProjectActions, * as projectActions from "../../../../redux/actions/projectActions";
import IApplicationActions, * as applicationActions from "../../../../redux/actions/applicationActions";
import IAppTitleActions, * as appTitleActions from "../../../../redux/actions/appTitleActions";

export interface IModelComposePageProps extends RouteComponentProps, React.Props<ModelComposePage> {
    recentProjects: IProject[];
    connections: IConnection[];
    appSettings: IAppSettings;
    project: IProject;
    actions: IProjectActions;
    applicationActions: IApplicationActions;
    appTitleActions: IAppTitleActions;
}

export interface IModelComposePageState {
    modelList: IModel[];
    columns: IColumn[];
    selectionDetails: string;
    isModalSelection: boolean;
    isCompactMode: boolean;
    isComposing: boolean;
    composedModelsId: string[];
}

export interface IModel {
    modelId: string;
    createdDateTime: string;
    lastUpdatedDateTime: string;
    status: string;
    iconName?: string;
}

function mapStateToProps(state: IApplicationState) {
    return {
        recentProjects: state.recentProjects,
        connections: state.connections,
        appSettings: state.appSettings,
        project: state.currentProject,
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators(projectActions, dispatch),
        applicationActions: bindActionCreators(applicationActions, dispatch),
        appTitleActions: bindActionCreators(appTitleActions, dispatch),
    };
}

@connect(mapStateToProps, mapDispatchToProps)
export default class ModelComposePage extends React.Component<IModelComposePageProps, IModelComposePageState> {
    private selection: Selection;
    private allModels: IModel[];

    constructor(props) {
        super(props);

        const columns: IColumn[] = [
            {
                key: "column1",
                name: "Composed Icon",
                className: "composed-icon-cell",
                isIconOnly: true,
                ariaLabel: "Model with icon is a new composed model",
                fieldName: "icon",
                minWidth: 20,
                maxWidth: 20,
                isResizable: true,
                onRender: (model: IModel) => {
                    return <FontIcon iconName={model.iconName} className="model-fontIcon"/> ;
                },
            },
            {
                key: "column2",
                name: "Model ID",
                fieldName: "modelId",
                minWidth: 100,
                isResizable: true,
                onColumnClick: this.handleColumnClick,
                onRender: (model: IModel) => {
                return <span>{model.modelId}</span>;
                },
            },
            {
                key: "column3",
                name: "Status",
                fieldName: "status",
                minWidth: 100,
                isResizable: true,
                onColumnClick: this.handleColumnClick,
                onRender: (model: IModel) => {
                return (<span>{model.status}</span>);
                },
            },
            {
                key: "column4",
                name: "Create Date Time",
                fieldName: "createdatetime",
                minWidth: 175,
                isResizable: true,
                isRowHeader: true,
                isSorted: true,
                isSortedDescending: true,
                onColumnClick: this.handleColumnClick,
                onRender: (model: IModel) => {
                    return <span>{new Date(model.createdDateTime).toLocaleString()}</span>;
                },
            },
            {
                key: "column5",
                name: "Last Updated Date Time",
                fieldName: "lastupdateddatetime",
                minWidth: 175,
                isResizable: true,
                onColumnClick: this.handleColumnClick,
                onRender: (model: IModel) => {
                    return (<span>{new Date(model.lastUpdatedDateTime).toLocaleString()}</span>);
                },
            },
        ];

        this.state = {
            modelList: [],
            columns,
            selectionDetails: this.handleSelection(),
            isModalSelection: false,
            isCompactMode: false,
            isComposing: false,
            composedModelsId: [],
        };

        this.selection = new Selection({
            onSelectionChanged: () => {
              this.setState({
                selectionDetails: this.handleSelection(),
              });
            },
          });
    }

    public async componentDidMount() {
        const projectId = this.props.match.params["projectId"];
        if (projectId) {
            const project = this.props.recentProjects.find((project) => project.id === projectId);
            await this.props.actions.loadProject(project);
            this.props.appTitleActions.setTitle(project.name);
        }

        if (this.props.project) {
            this.getModelList();
        }
        document.title = "Model compose page - " + strings.appName;
    }

    public componentDidUpdate(prevProps, prevState) {
        if ( prevState.isComposing === true &&
                prevState.isComposing !== this.state.isComposing) {
            this.selection.setAllSelected(false);
            if (this.props.project) {
                this.getModelList();
            }
        }
    }

    public render() {
        const {modelList, isCompactMode, columns} = this.state;
        const dark: ICustomizations = {
            settings: {
              theme: getDarkGreyTheme(),
            },
            scopedSettings: {},
        };

        return (
            <Fabric className="modelCompose-page">
                <Customizer {...dark}>
                    <div className="commandbar">
                        <ModelComposeCommandBar
                            composedModels={this.state.composedModelsId}
                            handleCompose={this.onComposeClick}
                            GetComposedItemsOnTop={this.handleGetComposedItemClick}
                            />
                    </div>
                    <div className="label-filter-background">
                        <TextField
                            label="Filter By Name"
                            className="label-filter-field"
                            theme={getPrimaryWhiteTheme()}
                            onChange={this.onTextChange}>
                        </TextField>
                    </div>
                    {this.state.isComposing ?
                    <Spinner
                        label="Model is composing, please wait..."
                        className="compose-spinner"
                        theme={getDefaultDarkTheme()}
                        size={SpinnerSize.large}>
                    </Spinner> :
                    <DetailsList
                        className="models-list"
                        items = {modelList}
                        compact={isCompactMode}
                        columns={columns}
                        selectionMode={SelectionMode.multiple}
                        layoutMode={DetailsListLayoutMode.justified}
                        isHeaderVisible={true}
                        selection={this.selection}
                        selectionPreservedOnEmptyClick={true}>
                    </DetailsList>
                    }
                </Customizer>
            </Fabric>
        );
    }

    private getModelList = async () => {
        try {
            let modelList = [];
            let nextLink = "";
            while (modelList.length <= 250) {
                const res = await this.getResponse(nextLink);
                const tmpList = res.data.modelList;
                console.log(tmpList);
                nextLink = res.data.nextLink;
                modelList = modelList.concat(tmpList);
            }
            modelList = modelList.splice(0, 250);
            modelList = this.copyAndSort(modelList, "createdatetime", true);
            let reorderedList = modelList;
            if (this.state.composedModelsId.length !== 0) {
               reorderedList = this.getComposedModelsOnTop(modelList);
            }
            this.allModels = reorderedList;
            this.setState({
                modelList: reorderedList,
            });
        } catch (error) {
            console.log(error);
        }
    }

    private async getResponse(nextLink?: string) {
        const baseURL = nextLink === "" ? url.resolve(
            this.props.project.apiUriBase,
            constants.apiModelsPath,
        ) : url.resolve(
            this.props.project.apiUriBase,
            nextLink,
        );
        console.log(baseURL);

        try {
            return await ServiceHelper.getWithAutoRetry(
                baseURL,
                {},
                this.props.project.apiKey as string,
            );
        } catch (err) {
            console.log(err);
            ServiceHelper.handleServiceError(err);
        }
    }

    private getComposedModelsOnTop = (modelList: IModel[]): IModel[] => {
        const composedModelCopy = [];
        modelList.map((m) => {
            if (this.state.composedModelsId.indexOf(m.modelId) !== -1) {
                m.iconName = "edit";
                composedModelCopy.push(m);
            }
        });
        const uncomposedModelList = modelList.filter(
            (m) => this.state.composedModelsId.indexOf(m.modelId) === -1 );

        const newModelList = composedModelCopy.concat(uncomposedModelList);
        return newModelList;
    }

    private handleColumnClick = (event: React.MouseEvent<HTMLElement>, column: IColumn): void => {
        const {columns, modelList} = this.state;
        const newColumns: IColumn[] = columns.slice();
        const currColumn: IColumn = newColumns.filter((col) => column.key === col.key)[0];
        newColumns.forEach((newCol: IColumn) => {
            if (newCol === currColumn) {
                currColumn.isSortedDescending = !currColumn.isSortedDescending;
                currColumn.isSorted = true;
            } else {
                newCol.isSorted = false;
                newCol.isSortedDescending = true;
            }
        });
        const newList = this.copyAndSort(modelList, currColumn.fieldName!, currColumn.isSortedDescending);
        this.allModels = newList;
        this.setState({
            columns: newColumns,
            modelList: newList,
        });
    }

    private copyAndSort(modelList: IModel[], columnKey: string, isSortedDescending?: boolean): IModel[] {
        const key = columnKey;
        if (key === "createdatetime" || key === "lastupdateddatetime") {
            return (modelList.slice(0)
            .sort((a, b): number => {
                if (isSortedDescending) {
                    if ((new Date(a.createdDateTime)).getTime() < (new Date(b.createdDateTime)).getTime()) {
                        return 1;
                    } else {
                        return -1;
                    }
                } else {
                    if ((new Date(a.createdDateTime)).getTime() > (new Date(b.createdDateTime)).getTime()) {
                        return 1;
                    } else {
                        return -1;
                    }
                }
            }));
        } else {
            return (modelList.slice(0)
            .sort((a: IModel, b: IModel) => ((isSortedDescending ? a[key] < b[key] : a[key] > b[key]) ? 1 : -1 )));
        }
    }

    private handleSelection = (): string => {
        console.log("handle selection");
        return "item selected";
    }

    private onComposeClick = () => {
        this.selection.getSelection().map((s) => console.log(s));
        this.setState({
            isComposing: true,
        });
        this.handleModelCompose();
    }

    private handleModelCompose = () => {
        setTimeout( () => {
            const newCols = this.state.columns;
            newCols.forEach((ncol) => {
                ncol.isSorted = false;
                ncol.isSortedDescending = true;
            });
            this.setState({
                isComposing: false,
                composedModelsId: ["003f503e-1361-4386-9a22-3111d5144b73"],
                columns: newCols,
                modelList: [],
        });
        }, 5000);
    }

    private onTextChange = (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, text: string): void => {
        this.setState({
            modelList: text ? this.allModels.filter((m) => m.modelId.indexOf(text) > -1) : this.allModels,
        });
    }

    private handleGetComposedItemClick = () => {
        if (this.state.composedModelsId) {
            const newList = this.getComposedModelsOnTop(this.state.modelList);
            const newCols = this.state.columns;
            newCols.forEach((ncol) => {
                ncol.isSorted = false;
                ncol.isSortedDescending = true;
            });
            this.setState({
                modelList: newList,
                columns: newCols,
            });
        }
    }

}
