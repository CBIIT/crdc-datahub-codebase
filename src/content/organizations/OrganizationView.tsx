import { FC, useEffect, useMemo, useState } from 'react';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import { LoadingButton } from '@mui/lab';
import {
  Alert, Box, Container, MenuItem,
  OutlinedInput, Select, Stack, Typography,
  styled,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { cloneDeep } from 'lodash';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import bannerSvg from '../../assets/banner/profile_banner.png';
import profileIcon from '../../assets/icons/organization.svg';
import SuspenseLoader from '../../components/SuspenseLoader';
import {
  CREATE_ORG, CreateOrgResp,
  EDIT_ORG, EditOrgResp,
  GET_ORG, GetOrgResp,
  LIST_APPROVED_STUDIES, ListApprovedStudiesResp,
  LIST_CURATORS, ListCuratorsResp,
} from '../../graphql';
import ConfirmDialog from '../../components/Organizations/ConfirmDialog';
import usePageTitle from '../../hooks/usePageTitle';
import { formatFullStudyName, mapOrganizationStudyToId } from '../../utils';

type Props = {
  _id: Organization["_id"] | "new";
};

type FormInput = Omit<EditOrganizationInput, "studies"> & {
  studies: ApprovedStudy["_id"][];
};

const StyledContainer = styled(Container)({
  marginBottom: "90px",
});

const StyledBanner = styled("div")({
  background: `url(${bannerSvg})`,
  backgroundBlendMode: "luminosity, normal",
  backgroundSize: "cover",
  backgroundPosition: "center",
  width: "100%",
  height: "153px",
});

const StyledPageTitle = styled(Typography)({
  fontFamily: "Nunito Sans",
  fontSize: "45px",
  fontWeight: 800,
  letterSpacing: "-1.5px",
  color: "#fff",
});

const StyledProfileIcon = styled("div")({
  position: "relative",
  transform: "translate(-218px, -75px)",
  "& img": {
    position: "absolute",
  },
  "& img:nth-of-type(1)": {
    zIndex: 2,
    filter: "drop-shadow(10px 13px 9px rgba(0, 0, 0, 0.35))",
  },
});

const StyledField = styled('div')({
  marginBottom: '10px',
  minHeight: '41px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  fontSize: '18px',
});

const StyledLabel = styled('span')({
  color: '#356AAD',
  fontWeight: '700',
  marginRight: '40px',
  minWidth: '135px',
});

const BaseInputStyling = {
  width: "363px",
  borderRadius: "8px",
  backgroundColor: "#fff",
  color: "#083A50",
  "& .MuiInputBase-input": {
    fontWeight: 400,
    fontSize: "18px",
    fontFamily: "'Nunito', 'Rubik', sans-serif",
    padding: "10px",
    height: "20px",
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "#6B7294",
  },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    border: "1px solid #209D7D",
    boxShadow: "2px 2px 4px 0px rgba(38, 184, 147, 0.10), -1px -1px 6px 0px rgba(38, 184, 147, 0.20)",
  },
  "& .MuiList-root": {
    padding: 0,
  },
  "& .MuiMenuItem-root.Mui-selected": {
    background: "#3E7E6D !important",
    color: "#FFFFFF !important",
  },
  "& .MuiMenuItem-root:hover": {
    background: "#D5EDE5",
  },
};

const StyledTextField = styled(OutlinedInput)(BaseInputStyling);

const StyledSelect = styled(Select)(BaseInputStyling);

const StyledButtonStack = styled(Stack)({
  marginTop: "50px",
});

const StyledButton = styled(LoadingButton)(({ txt, border }: { txt: string, border: string }) => ({
  borderRadius: "8px",
  border: `2px solid ${border}`,
  color: `${txt} !important`,
  width: "101px",
  height: "51px",
  textTransform: "none",
  fontWeight: 700,
  fontSize: "17px",
  padding: "6px 8px",
}));

const StyledContentStack = styled(Stack)({
  marginLeft: "-2px !important",
});

const StyledTitleBox = styled(Box)({
  marginTop: "-86px",
  marginBottom: "88px",
  width: "100%",
});

/**
 * Data Submission statuses that reflect an inactive submission
 */
const inactiveSubmissionStatus: SubmissionStatus[] = ["Completed", "Archived"];

/**
 * Edit/Create Organization View Component
 *
 * @param {Props} props
 * @returns {JSX.Element}
 */
const OrganizationView: FC<Props> = ({ _id }: Props) => {
  usePageTitle(`Organization ${!!_id && _id !== "new" ? _id : "Add"}`);

  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [dataSubmissions, setDataSubmissions] = useState<Partial<Submission>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);

  const assignedStudies: string[] = useMemo(() => {
    const activeStudies = {};
    const activeSubs = dataSubmissions?.filter((ds) => !inactiveSubmissionStatus.includes(ds?.status));

    organization?.studies?.forEach((s) => {
      // NOTE: The `Submission` type only has `studyAbbreviation`, we cannot compare IDs
      if (activeSubs?.some((ds) => ds?.studyAbbreviation === s?.studyAbbreviation)) {
        activeStudies[s?.studyAbbreviation] = true;
      }
    });

    return Object.keys(activeStudies) || [];
  }, [organization, dataSubmissions]);

  const { handleSubmit, register, reset, control } = useForm<FormInput>();
  const editableFields: (keyof FormInput)[] = [
    "name",
    "conciergeID",
    "studies",
    "status",
  ];

  const { data: activeCurators } = useQuery<ListCuratorsResp>(LIST_CURATORS, {
    context: { clientName: 'backend' },
    fetchPolicy: "cache-and-network",
  });

  const { data: approvedStudies, refetch: refetchStudies } = useQuery<ListApprovedStudiesResp>(LIST_APPROVED_STUDIES, {
    context: { clientName: 'backend' },
    fetchPolicy: "cache-and-network",
  });

  const [getOrganization] = useLazyQuery<GetOrgResp>(GET_ORG, {
    context: { clientName: 'backend' },
    fetchPolicy: 'no-cache'
  });

  const [editOrganization] = useMutation<EditOrgResp>(EDIT_ORG, {
    context: { clientName: 'backend' },
    fetchPolicy: 'no-cache'
  });

  const [createOrganization] = useMutation<CreateOrgResp>(CREATE_ORG, {
    context: { clientName: 'backend' },
    fetchPolicy: 'no-cache'
  });

  const handleBypassWarning = () => {
    setConfirmOpen(false);
    handleSubmit(onSubmit)();
  };

  const handlePreSubmit = (data: FormInput) => {
    if (_id !== "new") {
      const previousStudies = organization?.studies?.map((s) => s?.studyAbbreviation) || [];
      const removedActiveStudies = previousStudies
        .filter((s) => !data.studies?.includes(s))
        .filter((s) => assignedStudies.includes(s))
        .length;

      // If there are active submissions for a study being removed, show a warning
      if (removedActiveStudies) {
        setConfirmOpen(true);
        return;
      }
    }

    onSubmit(data);
  };

  const onSubmit = async (data: FormInput) => {
    setSaving(true);

    const studyMap: { [_id: string]: Pick<ApprovedStudy, "studyName" | "studyAbbreviation"> } = {};
    approvedStudies?.listApprovedStudies?.forEach(({ _id, studyName, studyAbbreviation }) => {
      studyMap[_id] = { studyName, studyAbbreviation };
    });

    const variables = {
      ...data,
      studies: data.studies.map((_id) => (studyMap[_id]))?.filter((s) => !!s?.studyName) || [],
    };

    if (_id === "new" && !organization?._id) {
      const { data: d, errors } = await createOrganization({ variables })
        .catch((e) => ({ errors: e?.message, data: null }));
      setSaving(false);

      if (errors || !d?.createOrganization?._id) {
        setError(errors || "Unable to create organization");
        return;
      }

      setOrganization(null);
      setDataSubmissions(null);
      enqueueSnackbar("This organization has been successfully added.", { variant: "default" });
      reset();
    } else {
      const { data: d, errors } = await editOrganization({ variables: { orgID: organization._id, ...variables, } })
        .catch((e) => ({ errors: e?.message, data: null }));
      setSaving(false);

      if (errors || !d?.editOrganization) {
        setError(errors || "Unable to save changes");
        return;
      }

      enqueueSnackbar("All changes have been saved", { variant: "default" });
      setFormValues(data);
      setOrganization((prev: Organization) => ({ ...prev, studies: d.editOrganization.studies }));
    }

    setError(null);
  };

  /**
   * Updates the default form values after save or initial fetch
   *
   * @param data FormInput
   */
  const setFormValues = (data: FormInput, fields = editableFields) => {
    const resetData = {};

    fields.forEach((field) => {
      resetData[field] = cloneDeep(data[field]);
    });

    reset(resetData);
  };

  useEffect(() => {
    setError(null);

    if (_id === "new") {
      setOrganization(null);
      setDataSubmissions(null);
      setFormValues({
        name: "",
        conciergeID: "",
        studies: [],
        status: "Active",
      }, ["name", "conciergeID", "studies", "status"]);
      return;
    }

    (async () => {
      const { data, error } = await getOrganization({ variables: { orgID: _id, organization: _id } });
      if (error || !data?.getOrganization) {
        navigate("/organizations", { state: { error: "Unable to fetch organization" } });
        return;
      }

      // No studies or original request did not complete. Refetch
      let studyList: ApprovedStudy[] = approvedStudies?.listApprovedStudies;
      if (!studyList?.length) {
        const { data } = await refetchStudies();
        studyList = data?.listApprovedStudies;
      }

      setOrganization(data?.getOrganization);
      setDataSubmissions(data?.listSubmissions?.submissions);
      setFormValues({
        ...data?.getOrganization,
        studies: data?.getOrganization?.studies
          ?.map((s) => mapOrganizationStudyToId(s, studyList || []))
          ?.filter((_id) => !!_id) || [],
      });
    })();
  }, [_id]);

  if (!organization && _id !== "new") {
    return <SuspenseLoader />;
  }

  return (
    <>
      <StyledBanner />
      <StyledContainer maxWidth="lg">
        <Stack
          direction="row"
          justifyContent="center"
          alignItems="flex-start"
          spacing={2}
        >
          <StyledProfileIcon>
            <img src={profileIcon} alt="organization icon" />
          </StyledProfileIcon>

          <StyledContentStack
            direction="column"
            justifyContent="center"
            alignItems="center"
            spacing={2}
          >
            <StyledTitleBox>
              <StyledPageTitle variant="h1">
                {_id !== "new" ? "Edit" : "Add"}
                {" "}
                Organization
              </StyledPageTitle>
            </StyledTitleBox>

            <form onSubmit={handleSubmit(handlePreSubmit)}>
              {error && (
                <Alert sx={{ mb: 2, p: 2, width: "100%" }} severity="error">
                  {error || "An unknown API error occurred."}
                </Alert>
              )}

              <StyledField>
                <StyledLabel id="organizationName">{_id !== "new" ? "Organization" : "Name"}</StyledLabel>
                <StyledTextField
                  {...register("name", { required: true })}
                  size="small"
                  required
                  inputProps={{ "aria-labelledby": "organizationName" }}
                />
              </StyledField>
              <StyledField>
                <StyledLabel id="primaryContactLabel">Primary Contact</StyledLabel>
                <Stack direction="column" justifyContent="flex-start" alignItems="flex-start" spacing={1}>
                  <Controller
                    name="conciergeID"
                    control={control}
                    rules={{ required: false }}
                    render={({ field }) => (
                      <StyledSelect
                        {...field}
                        value={field.value || ""}
                        MenuProps={{ disablePortal: true }}
                        inputProps={{ "aria-labelledby": "primaryContactLabel" }}
                      >
                        <MenuItem value={null}>{"<Not Set>"}</MenuItem>
                        {activeCurators?.listActiveCurators?.map(({ userID, firstName, lastName }) => (
                          <MenuItem key={userID} value={userID}>{(`${firstName} ${lastName}`).trim()}</MenuItem>
                        ))}
                      </StyledSelect>
                    )}
                  />
                </Stack>
              </StyledField>
              <StyledField>
                <StyledLabel id="studiesLabel">Studies</StyledLabel>
                <Controller
                  name="studies"
                  control={control}
                  rules={{ required: false }}
                  render={({ field }) => (
                    <StyledSelect
                      {...field}
                      value={field.value || []}
                      MenuProps={{ disablePortal: true }}
                      inputProps={{ "aria-labelledby": "studiesLabel" }}
                      multiple
                    >
                      {approvedStudies?.listApprovedStudies?.map(({ _id, studyName, studyAbbreviation }) => (
                        <MenuItem key={_id} value={_id}>
                          {formatFullStudyName(studyName, studyAbbreviation)}
                        </MenuItem>
                      ))}
                    </StyledSelect>
                  )}
                />
              </StyledField>
              <StyledField>
                <StyledLabel id="statusLabel">Status</StyledLabel>
                <Controller
                  name="status"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <StyledSelect
                      {...field}
                      value={field.value || ""}
                      disabled={_id === "new"}
                      MenuProps={{ disablePortal: true }}
                      inputProps={{ "aria-labelledby": "statusLabel" }}
                    >
                      <MenuItem value="Active">Active</MenuItem>
                      <MenuItem value="Inactive">Inactive</MenuItem>
                    </StyledSelect>
                  )}
                />
              </StyledField>

              <StyledButtonStack
                direction="row"
                justifyContent="center"
                alignItems="center"
                spacing={1}
              >
                <StyledButton type="submit" loading={saving} txt="#14634F" border="#26B893">Save</StyledButton>
                <StyledButton type="button" onClick={() => navigate("/organizations")} txt="#666666" border="#828282">Cancel</StyledButton>
              </StyledButtonStack>
            </form>
          </StyledContentStack>
        </Stack>
      </StyledContainer>
      <ConfirmDialog
        open={confirmOpen}
        onSubmit={handleBypassWarning}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
};

export default OrganizationView;
