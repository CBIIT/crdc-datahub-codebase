from bento_mdf import MDFReader

def get_model_from_mdf_files(files, handle):
    mdf = MDFReader(*files, handle=handle)
    return mdf.model